import { authenticateSocket } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * 实时通信服务类
 */
class RealtimeService {
  constructor() {
    this.io = null;
    this.connections = new Map(); // 存储连接信息
    this.channels = new Map(); // 存储频道信息
    this.messageBuffer = new Map(); // 消息缓冲区
    this.sequenceNumbers = new Map(); // 频道序列号
  }

  /**
   * 初始化Socket.IO服务
   */
  initialize(io) {
    this.io = io;
    
    // 设置认证中间件
    // io.use(authenticateSocket);
    
    // 监听连接事件
    io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('Socket.IO实时通信服务已初始化');
  }

  /**
   * 处理新连接
   */
  handleConnection(socket) {
    const user = socket.user;
    const connectionId = socket.id;

    logger.realtime('User Connected', {
      userId: user.userId,
      connectionId,
      role: user.role,
      totalConnections: this.connections.size + 1
    });

    // 存储连接信息
    this.connections.set(connectionId, {
      socket,
      user,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      subscribedChannels: new Set()
    });

    // 绑定事件处理器
    this.bindEventHandlers(socket);

    // 发送连接确认
    socket.emit('connected', {
      connectionId,
      timestamp: Date.now(),
      user: {
        id: user.userId,
        role: user.role
      }
    });
  }

  /**
   * 绑定事件处理器
   */
  bindEventHandlers(socket) {
    const connectionId = socket.id;

    // 订阅频道
    socket.on('subscribe', (data, callback) => {
      this.handleSubscribe(connectionId, data, callback);
    });

    // 取消订阅
    socket.on('unsubscribe', (data, callback) => {
      this.handleUnsubscribe(connectionId, data, callback);
    });

    // 发布消息
    socket.on('publish', (data, callback) => {
      this.handlePublish(connectionId, data, callback);
    });

    // 心跳
    socket.on('heartbeat', (data) => {
      this.handleHeartbeat(connectionId, data);
    });

    // 断开连接
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(connectionId, reason);
    });

    // 错误处理
    socket.on('error', (error) => {
      console.error(`Socket错误 (${connectionId}):`, error);
    });
  }

  /**
   * 处理订阅请求
   */
  async handleSubscribe(connectionId, data, callback) {
    try {
      const { topic, messageId } = data;
      const connection = this.connections.get(connectionId);

      if (!connection) {
        return this.sendError(callback, 'connection_not_found', '连接不存在');
      }

      // 检查权限
      if (!this.hasPermission(connection.user, topic, 'subscribe')) {
        return this.sendError(callback, 'permission_denied', '没有订阅权限');
      }

      // 加入Socket.IO房间
      connection.socket.join(topic);
      connection.subscribedChannels.add(topic);

      // 更新频道信息
      if (!this.channels.has(topic)) {
        this.channels.set(topic, {
          name: topic,
          subscribers: new Set(),
          createdAt: Date.now(),
          messageCount: 0
        });
      }

      const channel = this.channels.get(topic);
      channel.subscribers.add(connectionId);

      // 发送ACK
      this.sendAck(callback, messageId, 'success', {
        topic,
        subscriberCount: channel.subscribers.size
      });

      console.log(`用户 ${connection.user.userId} 订阅了频道 ${topic}`);

    } catch (error) {
      console.error('订阅处理失败:', error);
      this.sendError(callback, 'subscribe_failed', error.message);
    }
  }

  /**
   * 处理取消订阅请求
   */
  async handleUnsubscribe(connectionId, data, callback) {
    try {
      const { topic, messageId } = data;
      const connection = this.connections.get(connectionId);

      if (!connection) {
        return this.sendError(callback, 'connection_not_found', '连接不存在');
      }

      // 离开Socket.IO房间
      connection.socket.leave(topic);
      connection.subscribedChannels.delete(topic);

      // 更新频道信息
      const channel = this.channels.get(topic);
      if (channel) {
        channel.subscribers.delete(connectionId);
        
        // 如果没有订阅者了，删除频道
        if (channel.subscribers.size === 0) {
          this.channels.delete(topic);
        }
      }

      // 发送ACK
      this.sendAck(callback, messageId, 'success', {
        topic,
        subscriberCount: channel ? channel.subscribers.size : 0
      });

      console.log(`用户 ${connection.user.userId} 取消订阅频道 ${topic}`);

    } catch (error) {
      console.error('取消订阅处理失败:', error);
      this.sendError(callback, 'unsubscribe_failed', error.message);
    }
  }

  /**
   * 处理发布消息请求
   */
  async handlePublish(connectionId, data, callback) {
    try {
      const { topic, payload, messageId, ackRequired = true } = data;
      const connection = this.connections.get(connectionId);

      if (!connection) {
        return this.sendError(callback, 'connection_not_found', '连接不存在');
      }

      // 检查权限
      if (!this.hasPermission(connection.user, topic, 'publish')) {
        return this.sendError(callback, 'permission_denied', '没有发布权限');
      }

      // 检查频道是否存在
      if (!this.channels.has(topic)) {
        return this.sendError(callback, 'channel_not_found', '频道不存在');
      }

      // 生成消息
      const message = {
        id: uuidv4(),
        topic,
        type: 'event',
        payload,
        timestamp: Date.now(),
        from: connection.user.userId,
        seq: this.getNextSequenceNumber(topic)
      };

      // 发送消息到订阅者
      this.io.to(topic).emit('message', message);

      // 更新频道统计
      const channel = this.channels.get(topic);
      channel.messageCount++;

      // 发送ACK（如果需要）
      if (ackRequired) {
        this.sendAck(callback, messageId, 'success', {
          messageId: message.id,
          topic,
          seq: message.seq,
          deliveredTo: channel.subscribers.size
        });
      }

      console.log(`用户 ${connection.user.userId} 向频道 ${topic} 发布消息`);

    } catch (error) {
      console.error('发布消息失败:', error);
      this.sendError(callback, 'publish_failed', error.message);
    }
  }

  /**
   * 处理心跳
   */
  handleHeartbeat(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      connection.socket.emit('heartbeat_ack', {
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理断开连接
   */
  handleDisconnect(connectionId, reason) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log(`用户 ${connection.user.userId} 断开连接 (${connectionId}): ${reason}`);

    // 从所有订阅的频道中移除
    for (const topic of connection.subscribedChannels) {
      const channel = this.channels.get(topic);
      if (channel) {
        channel.subscribers.delete(connectionId);
        
        // 如果没有订阅者了，删除频道
        if (channel.subscribers.size === 0) {
          this.channels.delete(topic);
        }
      }
    }

    // 删除连接记录
    this.connections.delete(connectionId);
  }

  /**
   * 检查用户权限
   */
  hasPermission(user, topic, action) {
    // 系统管理员有所有权限
    if (user.role === 'admin') {
      return true;
    }

    // 检查频道类型和权限
    if (topic.startsWith('public:')) {
      return true; // 公共频道所有人可以访问
    }

    if (topic.startsWith('private:')) {
      // 私有频道需要特定权限
      return user.permissions?.includes('private_channel_access');
    }

    if (topic.startsWith(`user:${user.userId}`)) {
      return true; // 用户自己的频道
    }

    if (topic.startsWith('system:')) {
      // 系统频道只有管理员可以发布，但所有人可以订阅
      if (action === 'publish') {
        return user.role === 'admin';
      }
      return true;
    }

    return false;
  }

  /**
   * 获取下一个序列号
   */
  getNextSequenceNumber(topic) {
    const current = this.sequenceNumbers.get(topic) || 0;
    const next = current + 1;
    this.sequenceNumbers.set(topic, next);
    return next;
  }

  /**
   * 发送ACK响应
   */
  sendAck(callback, messageId, status, data = {}) {
    if (typeof callback === 'function') {
      callback({
        id: messageId,
        type: 'ack',
        status,
        ...data
      });
    }
  }

  /**
   * 发送错误响应
   */
  sendError(callback, code, message) {
    if (typeof callback === 'function') {
      callback({
        type: 'error',
        code,
        message
      });
    }
  }

  /**
   * 系统广播
   */
  broadcastSystemNotification(level, message, targetUsers = null) {
    try {
      const notification = {
        id: uuidv4(),
        type: 'notification',
        level,
        message,
        timestamp: Date.now()
      };

      if (targetUsers) {
        // 发送给特定用户
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
   * 获取服务统计信息
   */
  getStats() {
    return {
      connections: this.connections.size,
      channels: this.channels.size,
      totalMessages: Array.from(this.channels.values())
        .reduce((total, channel) => total + channel.messageCount, 0),
      channelDetails: Array.from(this.channels.entries()).map(([name, channel]) => ({
        name,
        subscribers: channel.subscribers.size,
        messageCount: channel.messageCount,
        createdAt: channel.createdAt
      }))
    };
  }

  /**
   * 清理过期连接
   */
  cleanupStaleConnections(timeoutMs = 5 * 60 * 1000) { // 5分钟
    const now = Date.now();
    let cleanedCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastActivity > timeoutMs) {
        console.log(`清理过期连接: ${connectionId}`);
        connection.socket.disconnect(true);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

export default RealtimeService;
