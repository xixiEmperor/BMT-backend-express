// 导入依赖模块
import { authenticateSocket } from '../middleware/auth.js'; // Socket认证中间件
import { v4 as uuidv4 } from 'uuid'; // UUID生成器，用于生成唯一标识符
import logger from '../utils/logger.js'; // 日志记录工具
import Connection from '../models/Connection.js'; // 连接数据模型

/**
 * 实时通信服务类
 * 负责管理WebSocket连接、频道订阅、消息发布等功能
 * 支持多客户端连接、频道权限控制、消息确认机制等
 */
class RealtimeService {
  /**
   * 构造函数 - 初始化实时通信服务的核心数据结构
   */
  constructor() {
    this.io = null; // Socket.IO服务器实例，管理所有WebSocket连接
    this.connections = new Map(); // 存储所有活跃连接信息，key: connectionId, value: 连接详情
    this.channels = new Map(); // 存储所有频道信息，key: 频道名称, value: 频道详情
    this.messageBuffer = new Map(); // 消息缓冲区，用于处理离线消息或重发机制
    this.sequenceNumbers = new Map(); // 各频道的消息序列号，确保消息有序性
  }

  /**
   * 初始化Socket.IO服务
   * @param {Object} io - Socket.IO服务器实例
   */
  initialize(io) {
    this.io = io;
    
    // 设置认证中间件（暂时注释，可根据需要启用）
    // io.use(authenticateSocket);

    io.use((socket, next) => {
      socket.user = {
        userId: socket.handshake.query.userId,
        role: socket.handshake.query.userRole,
      }
      console.log('用户连接:', socket.user);
      next();
    })
    
    // 监听客户端连接事件，当有新客户端连接时触发
    io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('Socket.IO实时通信服务已初始化');
  }

  /**
   * 处理新客户端连接
   * @param {Object} socket - Socket.IO客户端连接对象
   */
  async handleConnection(socket) {
    try {
      const user = socket.user; // 从socket中获取用户信息（通过认证中间件设置）
      const connectionId = socket.id; // 获取唯一的连接ID

      // 记录用户连接日志
      logger.realtime('User Connected', {
        userId: user.userId,
        connectionId,
        role: user.role,
        totalConnections: this.connections.size + 1
      });

      // 将连接信息存储到内存中，包含用户信息、连接时间、订阅频道等
      this.connections.set(connectionId, {
        socket, // Socket.IO连接对象
        user, // 用户信息
        connectedAt: Date.now(), // 连接建立时间
        lastActivity: Date.now(), // 最后活跃时间（用于心跳检测）
        subscribedChannels: new Set() // 该连接订阅的频道集合
      });

      // 将连接信息保存到数据库
      const connectionData = new Connection({
        connectionId,
        userId: user.userId,
        userRole: user.role,
        connectedAt: new Date(),
        lastActivity: new Date(),
        subscribedChannels: [],
        status: 'active'
      });
      await connectionData.save();

      // 为该socket绑定各种事件处理器
      this.bindEventHandlers(socket);

      // 向客户端发送连接成功确认消息
      socket.emit('connected', {
        connectionId,
        timestamp: Date.now(),
        user: {
          id: user.userId,
          role: user.role
        }
      });
    } catch (error) {
      console.error('处理连接失败:', error);
      socket.emit('error', { message: '连接处理失败' });
    }
  }

  /**
   * 为socket连接绑定各种事件处理器
   * @param {Object} socket - Socket.IO客户端连接对象
   */
  bindEventHandlers(socket) {
    const connectionId = socket.id;

    // 监听客户端订阅频道事件
    socket.on('subscribe', (data, callback) => {
      this.handleSubscribe(connectionId, data, callback);
    });

    // 监听客户端取消订阅事件
    socket.on('unsubscribe', (data, callback) => {
      this.handleUnsubscribe(connectionId, data, callback);
    });

    // 监听客户端发布消息事件
    socket.on('publish', (data, callback) => {
      this.handlePublish(connectionId, data, callback);
    });

    // 监听客户端心跳事件，用于保持连接活跃状态
    socket.on('heartbeat', (data) => {
      console.log('收到心跳事件:', data);
      this.handleHeartbeat(connectionId, data);
    });

    // 监听客户端断开连接事件
    socket.on('disconnect', (reason) => {
      console.log('客户端断开连接:', connectionId, reason);
      this.handleDisconnect(connectionId, reason);
    });

    // 监听socket错误事件
    socket.on('error', (error) => {
      console.error(`Socket错误 (${connectionId}):`, error);
    });
  }

  /**
   * 处理客户端订阅频道请求
   * @param {string} connectionId - 连接ID
   * @param {Object} data - 订阅数据，包含topic和messageId
   * @param {Function} callback - 回调函数，用于发送确认消息
   */
  async handleSubscribe(connectionId, data, callback) {
    try {
      const { topic, messageId } = data; // 解构获取频道名称和消息ID
      const connection = this.connections.get(connectionId); // 获取连接信息

      // 检查连接是否存在
      if (!connection) {
        return this.sendError(callback, 'connection_not_found', '连接不存在');
      }

      // 检查用户是否有订阅该频道的权限
      // if (!this.hasPermission(connection.user, topic, 'subscribe')) {
      //   return this.sendError(callback, 'permission_denied', '没有订阅权限');
      // }

      // 将socket加入指定的Socket.IO房间（频道）
      connection.socket.join(topic);
      connection.subscribedChannels.add(topic); // 记录该连接订阅的频道

      // 更新数据库中的连接信息
      await Connection.findOneAndUpdate(
        { connectionId },
        { 
          $addToSet: { subscribedChannels: topic },
          lastActivity: new Date()
        }
      );

      // 如果频道不存在，则创建新频道
      if (!this.channels.has(topic)) {
        this.channels.set(topic, {
          name: topic, // 频道名称
          subscribers: new Set(), // 订阅者集合
          createdAt: Date.now(), // 创建时间
          messageCount: 0 // 消息计数
        });
      }

      const channel = this.channels.get(topic);
      channel.subscribers.add(connectionId); // 将连接ID添加到订阅者列表

      // 发送订阅成功的确认消息
      this.sendAck(callback, messageId, 'success', {
        topic,
        subscriberCount: channel.subscribers.size // 返回当前订阅者数量
      });

      console.log(`用户 ${connection.user.userId} 订阅了频道 ${topic}`);

    } catch (error) {
      console.error('订阅处理失败:', error);
      this.sendError(callback, 'subscribe_failed', error.message);
    }
  }

  /**
   * 处理客户端取消订阅频道请求
   * @param {string} connectionId - 连接ID
   * @param {Object} data - 取消订阅数据，包含topic和messageId
   * @param {Function} callback - 回调函数，用于发送确认消息
   */
  async handleUnsubscribe(connectionId, data, callback) {
    try {
      const { topic, messageId } = data; // 解构获取频道名称和消息ID
      const connection = this.connections.get(connectionId); // 获取连接信息

      // 检查连接是否存在
      if (!connection) {
        return this.sendError(callback, 'connection_not_found', '连接不存在');
      }

      // 让socket离开指定的Socket.IO房间（频道）
      connection.socket.leave(topic);
      connection.subscribedChannels.delete(topic); // 从连接的订阅频道列表中移除

      // 更新数据库中的连接信息
      await Connection.findOneAndUpdate(
        { connectionId },
        { 
          $pull: { subscribedChannels: topic },
          lastActivity: new Date()
        }
      );

      // 更新频道的订阅者信息
      const channel = this.channels.get(topic);
      if (channel) {
        channel.subscribers.delete(connectionId); // 从频道订阅者列表中移除该连接
        
        // 如果频道没有订阅者了，删除频道以释放内存
        if (channel.subscribers.size === 0) {
          this.channels.delete(topic);
        }
      }

      // 发送取消订阅成功的确认消息
      this.sendAck(callback, messageId, 'success', {
        topic,
        subscriberCount: channel ? channel.subscribers.size : 0 // 返回剩余订阅者数量
      });

      console.log(`用户 ${connection.user.userId} 取消订阅频道 ${topic}`);

    } catch (error) {
      console.error('取消订阅处理失败:', error);
      this.sendError(callback, 'unsubscribe_failed', error.message);
    }
  }

  /**
   * 处理客户端发布消息请求
   * @param {string} connectionId - 连接ID
   * @param {Object} data - 消息数据，包含topic、payload、messageId等
   * @param {Function} callback - 回调函数，用于发送确认消息
   */
  async handlePublish(connectionId, data, callback) {
    try {
      const { topic, payload, messageId, ackRequired = true } = data; // 解构消息数据
      const connection = this.connections.get(connectionId); // 获取连接信息

      // 检查连接是否存在
      if (!connection) {
        return this.sendError(callback, 'connection_not_found', '连接不存在');
      }

      // 检查用户是否有向该频道发布消息的权限
      // if (!this.hasPermission(connection.user, topic, 'publish')) {
      //   return this.sendError(callback, 'permission_denied', '没有发布权限');
      // }

      // 检查目标频道是否存在
      if (!this.channels.has(topic)) {
        return this.sendError(callback, 'channel_not_found', '频道不存在');
      }

      // 构造消息对象
      const message = {
        id: uuidv4(), // 生成唯一消息ID
        topic, // 目标频道
        type: 'event', // 消息类型
        payload, // 消息内容
        timestamp: Date.now(), // 发送时间戳
        from: connection.user.userId, // 发送者用户ID
        seq: this.getNextSequenceNumber(topic) // 获取该频道的下一个序列号
      };

      // 向该频道的所有订阅者发送消息
      this.io.to(topic).emit('event', message);

      // 更新频道的消息统计
      const channel = this.channels.get(topic);
      channel.messageCount++;

      // 如果需要确认，发送ACK响应
      if (ackRequired) {
        this.sendAck(callback, messageId, 'success', {
          messageId: message.id, // 返回生成的消息ID
          topic,
          seq: message.seq, // 返回消息序列号
          deliveredTo: channel.subscribers.size // 返回消息投递的订阅者数量
        });
      }

      console.log(`用户 ${connection.user.userId} 向频道 ${topic} 发布消息`);

    } catch (error) {
      console.error('发布消息失败:', error);
      this.sendError(callback, 'publish_failed', error.message);
    }
  }

  /**
   * 处理客户端心跳请求
   * 用于保持连接活跃状态，防止连接超时
   * @param {string} connectionId - 连接ID
   * @param {Object} data - 心跳数据
   */
  async handleHeartbeat(connectionId, data) {
    try {
      const connection = this.connections.get(connectionId);
      if (connection) {
        // 更新连接的最后活跃时间
        connection.lastActivity = Date.now();
        
        // 更新数据库中的最后活跃时间
        await Connection.findOneAndUpdate(
          { connectionId },
          { lastActivity: new Date() }
        );
        
        // 向客户端发送心跳确认响应
        connection.socket.emit('heartbeat_ack', {
          timestamp: Date.now(),
          ...data
        });
      }
    } catch (error) {
      console.error('处理心跳失败:', error);
    }
  }

  /**
   * 处理客户端断开连接事件
   * 清理连接相关的所有资源和订阅关系
   * @param {string} connectionId - 连接ID
   * @param {string} reason - 断开连接的原因
   */
  async handleDisconnect(connectionId, reason) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;

      console.log(`用户 ${connection.user.userId} 断开连接 (${connectionId}): ${reason}`);

      // 更新数据库中的连接状态
      await Connection.findOneAndUpdate(
        { connectionId },
        { 
          status: 'disconnected',
          disconnectedAt: new Date(),
          disconnectReason: reason
        }
      );

      // 从该连接订阅的所有频道中移除该连接
      for (const topic of connection.subscribedChannels) {
        const channel = this.channels.get(topic);
        if (channel) {
          channel.subscribers.delete(connectionId); // 从频道订阅者列表中移除
          
          // 如果频道没有订阅者了，删除频道以释放内存
          if (channel.subscribers.size === 0) {
            this.channels.delete(topic);
          }
        }
      }

      // 从连接管理器中删除该连接记录
      this.connections.delete(connectionId);
    } catch (error) {
      console.error('处理断开连接失败:', error);
    }
  }

  /**
   * 检查用户对指定频道的操作权限
   * @param {Object} user - 用户对象，包含userId、role、permissions等信息
   * @param {string} topic - 频道名称
   * @param {string} action - 操作类型（'subscribe' | 'publish'）
   * @returns {boolean} 是否有权限
   */
  hasPermission(user, topic, action) {
    // 系统管理员拥有所有频道的所有权限
    if (user.role === 'ROLE_ADMIN') {
      return true;
    }

    // 根据频道前缀检查权限
    if (topic.startsWith('public:')) {
      return true; // 公共频道：所有用户都可以订阅和发布
    }

    if (topic.startsWith('private:')) {
      // 私有频道：需要特定权限才能访问
      return user.permissions?.includes('private_channel_access');
    }

    if (topic.startsWith(`user:${user.userId}`)) {
      return true; // 用户专属频道：用户对自己的频道有完全权限
    }

    if (topic.startsWith('system:')) {
      // 系统频道：所有用户可以订阅，但只有管理员可以发布
      if (action === 'publish') {
        return user.role === 'ROLE_ADMIN';
      }
      return true; // 允许订阅
    }

    // 默认情况下拒绝访问
    return false;
  }

  /**
   * 获取指定频道的下一个消息序列号
   * 序列号用于保证消息的顺序性，便于客户端检测消息丢失
   * @param {string} topic - 频道名称
   * @returns {number} 下一个序列号
   */
  getNextSequenceNumber(topic) {
    const current = this.sequenceNumbers.get(topic) || 0; // 获取当前序列号，默认为0
    const next = current + 1; // 计算下一个序列号
    this.sequenceNumbers.set(topic, next); // 更新存储的序列号
    return next;
  }

  /**
   * 发送确认(ACK)响应给客户端
   * @param {Function} callback - 客户端回调函数
   * @param {string} messageId - 原始消息ID
   * @param {string} status - 状态（'success' | 'error'）
   * @param {Object} data - 额外返回数据
   */
  sendAck(callback, messageId, status, data = {}) {
    if (typeof callback === 'function') {
      callback({
        id: messageId, // 原始消息ID
        type: 'ack', // 响应类型
        status, // 处理状态
        ...data // 扩展数据
      });
    }
  }

  /**
   * 发送错误响应给客户端
   * @param {Function} callback - 客户端回调函数
   * @param {string} code - 错误代码
   * @param {string} message - 错误信息
   */
  sendError(callback, code, message) {
    if (typeof callback === 'function') {
      callback({
        type: 'error', // 响应类型
        code, // 错误代码
        message // 错误信息
      });
    }
  }

  /**
   * 系统广播通知
   * 用于向所有用户或指定用户发送系统级通知消息
   * @param {string} level - 通知级别（'info' | 'warning' | 'error' | 'success'）
   * @param {string} message - 通知消息内容
   * @param {Array<string>} targetUsers - 目标用户ID数组，为null时广播给所有用户
   */
  broadcastSystemNotification(level, message, targetUsers = null) {
    try {
      // 构造通知消息对象
      const notification = {
        id: uuidv4(), // 生成唯一通知ID
        type: 'notification', // 消息类型
        level, // 通知级别
        message, // 通知内容
        timestamp: Date.now() // 发送时间戳
      };

      if (targetUsers) {
        // 发送给指定的用户列表
        for (const [connectionId, connection] of this.connections.entries()) {
          if (targetUsers.includes(connection.user.userId)) {
            connection.socket.emit('notification', notification);
          }
        }
      } else {
        // 广播给所有连接的用户
        this.io.emit('notification', notification);
      }

      console.log(`系统广播通知: ${message}`);

    } catch (error) {
      console.error('广播通知失败:', error);
    }
  }

  /**
   * 获取实时通信服务的统计信息
   * 包含连接数、频道数、消息总数等运营数据
   * @returns {Object} 统计信息对象
   */
  async getStats() {
    try {
      // 从数据库获取连接统计
      const totalConnections = await Connection.countDocuments();
      const activeConnections = await Connection.countDocuments({ status: 'active' });
      const disconnectedConnections = await Connection.countDocuments({ status: 'disconnected' });
      
      // 获取用户角色分布
      const roleStats = await Connection.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$userRole', count: { $sum: 1 } } }
      ]);
      
      return {
        connections: this.connections.size, // 当前内存中活跃连接数
        totalConnections, // 数据库中总连接数
        activeConnections, // 数据库中活跃连接数
        disconnectedConnections, // 数据库中已断开连接数
        channels: this.channels.size, // 当前频道总数
        totalMessages: Array.from(this.channels.values()) // 所有频道的消息总数
          .reduce((total, channel) => total + channel.messageCount, 0),
        roleStats: roleStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        channelDetails: Array.from(this.channels.entries()).map(([name, channel]) => ({
          name, // 频道名称
          subscribers: channel.subscribers.size, // 订阅者数量
          messageCount: channel.messageCount, // 频道消息数
          createdAt: channel.createdAt // 频道创建时间
        }))
      };
    } catch (error) {
      console.error('获取统计信息失败:', error);
      return {
        connections: this.connections.size,
        channels: this.channels.size,
        totalMessages: 0,
        error: error.message
      };
    }
  }

  /**
   * 清理过期的WebSocket连接
   * 定期调用此方法可以释放长时间无活动的连接资源
   * @param {number} timeoutMs - 超时时间（毫秒），默认5分钟
   * @returns {number} 清理的连接数量
   */
  async cleanupStaleConnections(timeoutMs = 5 * 60 * 1000) { // 默认5分钟超时
    try {
      const now = Date.now();
      const cutoffTime = new Date(now - timeoutMs);
      let cleanedCount = 0;

      // 遍历所有连接，检查是否超时
      for (const [connectionId, connection] of this.connections.entries()) {
        if (now - connection.lastActivity > timeoutMs) {
          console.log(`清理过期连接: ${connectionId}`);
          connection.socket.disconnect(true); // 强制断开连接
          cleanedCount++;
        }
      }

      // 清理数据库中的过期连接记录
      const dbCleanupResult = await Connection.updateMany(
        { 
          status: 'active',
          lastActivity: { $lt: cutoffTime }
        },
        { 
          status: 'timeout',
          disconnectedAt: new Date(),
          disconnectReason: 'timeout'
        }
      );

      console.log(`清理了 ${cleanedCount} 个内存连接，${dbCleanupResult.modifiedCount} 个数据库连接`);
      return cleanedCount; // 返回清理的连接数量
    } catch (error) {
      console.error('清理过期连接失败:', error);
      return 0;
    }
  }
}

// 导出实时通信服务类
export default RealtimeService;
