# BMT Platform 实时通信前端对接指南

## 📡 概述

BMT Platform 提供基于 Socket.IO 的实时通信功能，支持双向消息传递、频道订阅、权限控制等特性。本文档详细介绍前端如何对接和使用实时通信功能。

**WebSocket服务地址**: `ws://localhost:5000`  
**协议**: Socket.IO v4.x  
**命名空间**: `/` (默认)

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install socket.io-client
# 或
yarn add socket.io-client
```

### 2. 基础连接

```javascript
import { io } from 'socket.io-client';

// 建立连接
const socket = io('ws://localhost:5000', {
  auth: {
    token: 'Bearer ' + accessToken  // 必须提供有效的JWT令牌
  },
  transports: ['websocket'],        // 优先使用WebSocket
  reconnection: true,               // 自动重连
  reconnectionDelay: 1000,          // 重连延迟
  reconnectionAttempts: 5,          // 最大重连次数
  timeout: 20000                    // 连接超时
});
```

### 3. 连接状态监听

```javascript
// 连接成功
socket.on('connect', () => {
  console.log('🔗 已连接到服务器');
  console.log('连接ID:', socket.id);
});

// 连接失败
socket.on('connect_error', (error) => {
  console.error('❌ 连接失败:', error.message);
  if (error.message.includes('Authentication failed')) {
    // 认证失败，需要重新登录
    redirectToLogin();
  }
});

// 断开连接
socket.on('disconnect', (reason) => {
  console.log('🔌 连接断开:', reason);
  if (reason === 'io server disconnect') {
    // 服务器主动断开，可能令牌过期
    handleTokenExpired();
  }
});

// 重连尝试
socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`🔄 第${attemptNumber}次重连尝试...`);
});

// 重连成功
socket.on('reconnect', () => {
  console.log('✅ 重连成功');
});
```

---

## 🏷️ 频道系统

### 频道类型

BMT Platform 支持4种类型的频道：

| 频道类型 | 命名格式 | 权限说明 | 示例 |
|---------|----------|----------|------|
| **公共频道** | `public:频道名` | 所有用户可访问 | `public:notifications` |
| **私有频道** | `private:频道名` | 需要特定权限 | `private:admin-only` |
| **用户频道** | `user:用户ID` | 用户专属频道 | `user:123` |
| **系统频道** | `system:功能名` | 系统通知频道 | `system:notifications` |

### 权限规则

```javascript
// 权限示例
const channelPermissions = {
  // 管理员：所有频道
  admin: ['public:*', 'private:*', 'user:*', 'system:*'],
  
  // 普通用户
  user: [
    'public:*',           // 所有公共频道
    'user:self',          // 自己的用户频道
    'system:notifications' // 系统通知（只读）
  ],
  
  // 访客
  guest: [
    'public:general',     // 仅限通用公共频道
    'system:notifications'
  ]
};
```

---

## 📥 频道订阅

### 订阅频道

```javascript
/**
 * 订阅频道
 * @param {string} topic - 频道名称
 * @param {Function} callback - 回调函数
 */
function subscribeChannel(topic, callback) {
  const messageId = generateMessageId();
  
  socket.emit('subscribe', {
    topic: topic,
    messageId: messageId,
    timestamp: Date.now()
  }, (response) => {
    if (response.status === 'success') {
      console.log(`✅ 订阅成功: ${topic}`);
      console.log(`👥 订阅者数量: ${response.subscriberCount}`);
      callback && callback(null, response);
    } else {
      console.error(`❌ 订阅失败: ${topic}`, response.error);
      callback && callback(new Error(response.error));
    }
  });
}

// 使用示例
subscribeChannel('public:notifications', (error, result) => {
  if (!error) {
    console.log('订阅通知频道成功');
  }
});
```

### 批量订阅

```javascript
/**
 * 批量订阅多个频道
 * @param {string[]} channels - 频道列表
 * @param {Function} callback - 完成回调
 */
async function subscribeMultipleChannels(channels, callback) {
  const results = [];
  const errors = [];

  for (const channel of channels) {
    try {
      await new Promise((resolve, reject) => {
        subscribeChannel(channel, (error, result) => {
          if (error) {
            errors.push({ channel, error: error.message });
            reject(error);
          } else {
            results.push({ channel, result });
            resolve(result);
          }
        });
      });
    } catch (error) {
      // 继续处理其他频道
      continue;
    }
  }

  callback && callback(errors.length > 0 ? errors : null, results);
}

// 使用示例
subscribeMultipleChannels([
  'public:notifications',
  'public:chat',
  'user:123'
], (errors, results) => {
  if (errors) {
    console.error('部分频道订阅失败:', errors);
  }
  console.log('订阅结果:', results);
});
```

### 取消订阅

```javascript
/**
 * 取消订阅频道
 * @param {string} topic - 频道名称
 * @param {Function} callback - 回调函数
 */
function unsubscribeChannel(topic, callback) {
  const messageId = generateMessageId();
  
  socket.emit('unsubscribe', {
    topic: topic,
    messageId: messageId,
    timestamp: Date.now()
  }, (response) => {
    if (response.status === 'success') {
      console.log(`🚫 取消订阅: ${topic}`);
      callback && callback(null, response);
    } else {
      console.error(`❌ 取消订阅失败: ${topic}`, response.error);
      callback && callback(new Error(response.error));
    }
  });
}
```

---

## 📤 消息发布

### 基础发布

```javascript
/**
 * 发布消息到频道
 * @param {string} topic - 目标频道
 * @param {any} payload - 消息内容
 * @param {Object} options - 选项
 * @param {Function} callback - 回调函数
 */
function publishMessage(topic, payload, options = {}, callback) {
  const messageId = generateMessageId();
  
  const messageData = {
    topic: topic,
    payload: payload,
    messageId: messageId,
    timestamp: Date.now(),
    ackRequired: options.ackRequired !== false,  // 默认需要确认
    priority: options.priority || 'normal',      // 消息优先级
    ttl: options.ttl || 0                        // 生存时间（0=永不过期）
  };

  socket.emit('publish', messageData, (response) => {
    if (response.status === 'success') {
      console.log(`📤 消息发布成功: ${topic}`);
      console.log(`📊 送达数量: ${response.deliveredTo}`);
      callback && callback(null, response);
    } else {
      console.error(`❌ 消息发布失败: ${topic}`, response.error);
      callback && callback(new Error(response.error));
    }
  });
}

// 使用示例
publishMessage('public:chat', {
  type: 'text',
  content: 'Hello, everyone!',
  user: {
    id: 'user_123',
    name: 'Alice'
  }
}, {
  ackRequired: true,
  priority: 'normal'
}, (error, result) => {
  if (!error) {
    console.log('消息发送成功');
  }
});
```

### 不同类型的消息

```javascript
// 文本消息
publishMessage('public:chat', {
  type: 'text',
  content: 'Hello World!',
  metadata: {
    timestamp: Date.now(),
    client: 'web'
  }
});

// 图片消息
publishMessage('public:chat', {
  type: 'image',
  content: {
    url: 'https://example.com/image.jpg',
    thumbnail: 'https://example.com/thumb.jpg',
    alt: '图片描述'
  }
});

// 系统消息
publishMessage('public:chat', {
  type: 'system',
  content: '用户 Alice 加入了聊天',
  level: 'info'
});

// 数据更新消息
publishMessage('public:dashboard', {
  type: 'data_update',
  content: {
    entity: 'orders',
    action: 'created',
    data: { id: 123, total: 99.99 }
  }
});
```

---

## 📨 消息接收

### 监听消息

```javascript
// 监听频道消息
socket.on('message', (data) => {
  console.log('📨 收到消息:', data);
  
  const {
    id,           // 消息ID
    topic,        // 来源频道
    type,         // 消息类型
    payload,      // 消息内容
    timestamp,    // 时间戳
    from,         // 发送者ID
    seq          // 序列号
  } = data;

  // 根据频道处理消息
  handleChannelMessage(topic, data);
});

// 按频道分发消息
function handleChannelMessage(topic, message) {
  switch (true) {
    case topic.startsWith('public:chat'):
      handleChatMessage(message);
      break;
      
    case topic.startsWith('public:notifications'):
      handleNotificationMessage(message);
      break;
      
    case topic.startsWith('public:dashboard'):
      handleDashboardUpdate(message);
      break;
      
    case topic.startsWith('user:'):
      handlePrivateMessage(message);
      break;
      
    default:
      console.log('未处理的频道消息:', topic, message);
  }
}
```

### 消息类型处理

```javascript
// 聊天消息处理
function handleChatMessage(message) {
  const { payload } = message;
  
  switch (payload.type) {
    case 'text':
      displayTextMessage(payload);
      break;
    case 'image':
      displayImageMessage(payload);
      break;
    case 'system':
      displaySystemMessage(payload);
      break;
  }
}

// 通知消息处理
function handleNotificationMessage(message) {
  const { payload } = message;
  
  // 显示桌面通知
  if (Notification.permission === 'granted') {
    new Notification(payload.title || '新通知', {
      body: payload.content,
      icon: '/favicon.ico',
      tag: message.id
    });
  }
  
  // 更新UI通知计数
  updateNotificationCount();
}

// 数据更新处理
function handleDashboardUpdate(message) {
  const { payload } = message;
  
  if (payload.type === 'data_update') {
    // 更新相应的数据和UI
    updateEntityData(payload.content.entity, payload.content.data);
  }
}
```

---

## 🔔 系统通知

### 监听系统通知

```javascript
// 监听系统通知
socket.on('notification', (notification) => {
  console.log('🔔 系统通知:', notification);
  
  const {
    id,          // 通知ID
    type,        // 通知类型: 'notification'
    level,       // 级别: 'info' | 'warning' | 'error'
    message,     // 通知内容
    timestamp    // 时间戳
  } = notification;

  handleSystemNotification(notification);
});

// 处理系统通知
function handleSystemNotification(notification) {
  const { level, message } = notification;
  
  // 根据级别显示不同样式
  switch (level) {
    case 'info':
      showInfoToast(message);
      break;
    case 'warning':
      showWarningDialog(message);
      break;
    case 'error':
      showErrorAlert(message);
      break;
  }
  
  // 记录到本地存储
  saveNotificationHistory(notification);
}
```

---

## 🔄 连接管理

### 完整的连接管理类

```javascript
class RealtimeClient {
  constructor(serverUrl, options = {}) {
    this.serverUrl = serverUrl;
    this.options = {
      reconnectionDelay: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      ...options
    };
    
    this.socket = null;
    this.reconnectAttempts = 0;
    this.heartbeatTimer = null;
    this.subscribedChannels = new Set();
    this.messageQueue = [];
    this.eventHandlers = new Map();
  }

  /**
   * 建立连接
   */
  async connect(token) {
    try {
      this.socket = io(this.serverUrl, {
        auth: { token: `Bearer ${token}` },
        transports: ['websocket'],
        reconnection: false  // 手动控制重连
      });

      this.bindEvents();
      this.startHeartbeat();
      
      return new Promise((resolve, reject) => {
        this.socket.on('connected', (data) => {
          console.log('✅ 连接建立成功', data);
          this.reconnectAttempts = 0;
          this.processMessageQueue();
          resolve(data);
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ 连接失败', error);
          reject(error);
        });
      });
    } catch (error) {
      console.error('连接初始化失败:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.stopHeartbeat();
    this.subscribedChannels.clear();
    this.messageQueue = [];
  }

  /**
   * 绑定事件监听
   */
  bindEvents() {
    this.socket.on('connect', () => {
      console.log('🔗 Socket连接建立');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 连接断开:', reason);
      this.handleDisconnect(reason);
    });

    this.socket.on('message', (data) => {
      this.emit('message', data);
    });

    this.socket.on('notification', (data) => {
      this.emit('notification', data);
    });

    this.socket.on('ack', (data) => {
      this.emit('ack', data);
    });

    this.socket.on('error', (error) => {
      console.error('Socket错误:', error);
      this.emit('error', error);
    });
  }

  /**
   * 处理断开连接
   */
  async handleDisconnect(reason) {
    this.stopHeartbeat();

    if (reason === 'io server disconnect') {
      // 服务器主动断开，可能是token过期
      this.emit('tokenExpired');
      return;
    }

    // 自动重连
    if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 第${this.reconnectAttempts}次重连尝试...`);
      
      setTimeout(() => {
        this.reconnect();
      }, this.options.reconnectionDelay * this.reconnectAttempts);
    } else {
      console.error('❌ 达到最大重连次数，停止重连');
      this.emit('reconnectFailed');
    }
  }

  /**
   * 重新连接
   */
  async reconnect() {
    try {
      if (this.socket) {
        this.socket.connect();
      }
    } catch (error) {
      console.error('重连失败:', error);
      this.handleDisconnect('reconnect_failed');
    }
  }

  /**
   * 开始心跳
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat', {
          timestamp: Date.now()
        });
      }
    }, this.options.heartbeatInterval);

    // 监听心跳确认
    this.socket?.on('heartbeat_ack', (data) => {
      console.log('💓 心跳确认:', data.timestamp);
    });
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 订阅频道
   */
  async subscribe(topic) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        // 连接断开时加入队列
        this.messageQueue.push({
          type: 'subscribe',
          topic,
          resolve,
          reject
        });
        return;
      }

      const messageId = generateMessageId();
      
      this.socket.emit('subscribe', {
        topic,
        messageId,
        timestamp: Date.now()
      }, (response) => {
        if (response.status === 'success') {
          this.subscribedChannels.add(topic);
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  /**
   * 发布消息
   */
  async publish(topic, payload, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        // 连接断开时加入队列
        this.messageQueue.push({
          type: 'publish',
          topic,
          payload,
          options,
          resolve,
          reject
        });
        return;
      }

      const messageId = generateMessageId();
      
      this.socket.emit('publish', {
        topic,
        payload,
        messageId,
        timestamp: Date.now(),
        ackRequired: options.ackRequired !== false
      }, (response) => {
        if (response.status === 'success') {
          resolve(response);
        } else {
          reject(new Error(response.error));
        }
      });
    });
  }

  /**
   * 处理消息队列
   */
  async processMessageQueue() {
    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const message of queue) {
      try {
        if (message.type === 'subscribe') {
          const result = await this.subscribe(message.topic);
          message.resolve(result);
        } else if (message.type === 'publish') {
          const result = await this.publish(
            message.topic, 
            message.payload, 
            message.options
          );
          message.resolve(result);
        }
      } catch (error) {
        message.reject(error);
      }
    }
  }

  /**
   * 事件监听
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * 触发事件
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`事件处理器错误 [${event}]:`, error);
      }
    });
  }

  /**
   * 获取连接状态
   */
  get connected() {
    return this.socket?.connected || false;
  }

  /**
   * 获取连接ID
   */
  get connectionId() {
    return this.socket?.id;
  }
}
```

---

## 🛠️ 实用工具函数

### 消息ID生成器

```javascript
/**
 * 生成唯一消息ID
 */
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
```

### 频道名称验证

```javascript
/**
 * 验证频道名称格式
 * @param {string} channelName - 频道名称
 * @returns {boolean} 是否有效
 */
function validateChannelName(channelName) {
  // 频道名称规则：type:name 格式，不含特殊字符
  const pattern = /^(public|private|user|system):[a-zA-Z0-9_-]+$/;
  return pattern.test(channelName);
}

/**
 * 解析频道名称
 * @param {string} channelName - 频道名称
 * @returns {Object} 解析结果
 */
function parseChannelName(channelName) {
  const [type, name] = channelName.split(':');
  return { type, name, full: channelName };
}
```

### 消息去重

```javascript
/**
 * 消息去重管理器
 */
class MessageDeduplicator {
  constructor(maxSize = 1000) {
    this.messageIds = new Set();
    this.maxSize = maxSize;
  }

  /**
   * 检查消息是否重复
   */
  isDuplicate(messageId) {
    if (this.messageIds.has(messageId)) {
      return true;
    }

    // 添加到集合
    this.messageIds.add(messageId);

    // 限制集合大小
    if (this.messageIds.size > this.maxSize) {
      const firstId = this.messageIds.values().next().value;
      this.messageIds.delete(firstId);
    }

    return false;
  }

  /**
   * 清理旧消息ID
   */
  clear() {
    this.messageIds.clear();
  }
}

const deduplicator = new MessageDeduplicator();

// 在消息处理中使用
socket.on('message', (data) => {
  if (deduplicator.isDuplicate(data.id)) {
    console.log('忽略重复消息:', data.id);
    return;
  }

  // 处理新消息
  handleMessage(data);
});
```

---

## 📱 React集成示例

### Hook封装

```javascript
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 实时通信Hook
 */
export function useRealtime(serverUrl, token) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const clientRef = useRef(null);

  // 初始化连接
  useEffect(() => {
    if (!token) return;

    const client = new RealtimeClient(serverUrl);
    clientRef.current = client;

    // 绑定事件
    client.on('message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    client.on('notification', (notification) => {
      // 处理系统通知
      console.log('系统通知:', notification);
    });

    client.on('error', (error) => {
      setError(error.message);
    });

    client.on('tokenExpired', () => {
      // 处理token过期
      setError('认证过期，请重新登录');
    });

    // 建立连接
    client.connect(token)
      .then(() => {
        setConnected(true);
        setError(null);
      })
      .catch((error) => {
        setError(error.message);
        setConnected(false);
      });

    // 清理
    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [serverUrl, token]);

  // 订阅频道
  const subscribe = useCallback(async (channel) => {
    if (!clientRef.current) return;
    
    try {
      await clientRef.current.subscribe(channel);
      console.log(`订阅频道成功: ${channel}`);
    } catch (error) {
      console.error(`订阅频道失败: ${channel}`, error);
      throw error;
    }
  }, []);

  // 发布消息
  const publish = useCallback(async (channel, payload, options) => {
    if (!clientRef.current) return;
    
    try {
      await clientRef.current.publish(channel, payload, options);
      console.log(`消息发布成功: ${channel}`);
    } catch (error) {
      console.error(`消息发布失败: ${channel}`, error);
      throw error;
    }
  }, []);

  // 清空消息
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    connected,
    error,
    messages,
    subscribe,
    publish,
    clearMessages,
    client: clientRef.current
  };
}
```

### 组件使用示例

```javascript
import React, { useEffect } from 'react';
import { useRealtime } from './hooks/useRealtime';

function ChatComponent({ accessToken }) {
  const { connected, error, messages, subscribe, publish } = useRealtime(
    'ws://localhost:5000',
    accessToken
  );

  // 组件挂载时订阅聊天频道
  useEffect(() => {
    if (connected) {
      subscribe('public:chat');
      subscribe('public:notifications');
    }
  }, [connected, subscribe]);

  // 发送消息
  const sendMessage = async (content) => {
    try {
      await publish('public:chat', {
        type: 'text',
        content: content,
        user: {
          id: 'current_user_id',
          name: 'Current User'
        }
      });
    } catch (error) {
      console.error('发送消息失败:', error);
    }
  };

  if (error) {
    return <div className="error">连接错误: {error}</div>;
  }

  if (!connected) {
    return <div className="loading">正在连接...</div>;
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={msg.id || index} className="message">
            <strong>{msg.payload.user?.name}:</strong>
            <span>{msg.payload.content}</span>
          </div>
        ))}
      </div>
      
      <MessageInput onSend={sendMessage} />
    </div>
  );
}
```

---

## 🔧 调试和故障排除

### 调试模式

```javascript
// 启用详细日志
const socket = io('ws://localhost:5000', {
  auth: { token: 'Bearer ' + token },
  forceNew: true,
  upgrade: false,
  transports: ['websocket']
});

// 调试事件监听
socket.onAny((event, ...args) => {
  console.log(`📡 [${event}]`, args);
});

// 监听所有outgoing事件
socket.onAnyOutgoing((event, ...args) => {
  console.log(`📤 [${event}]`, args);
});
```

### 常见问题解决

```javascript
// 1. 连接超时
const connectionTimeout = setTimeout(() => {
  if (!socket.connected) {
    console.error('连接超时');
    socket.disconnect();
  }
}, 10000);

socket.on('connect', () => {
  clearTimeout(connectionTimeout);
});

// 2. 认证失败重试
socket.on('connect_error', (error) => {
  if (error.message.includes('Authentication failed')) {
    // 尝试刷新token后重连
    refreshToken().then(newToken => {
      socket.auth.token = `Bearer ${newToken}`;
      socket.connect();
    });
  }
});

// 3. 网络状态监听
window.addEventListener('online', () => {
  if (!socket.connected) {
    console.log('网络恢复，尝试重连...');
    socket.connect();
  }
});

window.addEventListener('offline', () => {
  console.log('网络断开');
});
```

### 性能监控

```javascript
// 连接延迟监控
const connectStart = Date.now();
socket.on('connect', () => {
  const latency = Date.now() - connectStart;
  console.log(`连接延迟: ${latency}ms`);
});

// 消息延迟监控
function publishWithLatencyTracking(topic, payload) {
  const sendTime = Date.now();
  const messageId = generateMessageId();
  
  socket.emit('publish', {
    topic,
    payload: { ...payload, _sendTime: sendTime },
    messageId
  }, (response) => {
    if (response.status === 'success') {
      const latency = Date.now() - sendTime;
      console.log(`消息延迟: ${latency}ms`);
    }
  });
}
```

---

## 📊 最佳实践

### 1. 连接管理

```javascript
// ✅ 好的做法
class RealtimeManager {
  constructor() {
    this.client = null;
    this.reconnectTimer = null;
    this.subscriptions = new Map();
  }

  async connect(token) {
    try {
      this.client = new RealtimeClient('ws://localhost:5000');
      await this.client.connect(token);
      
      // 恢复之前的订阅
      await this.restoreSubscriptions();
    } catch (error) {
      this.scheduleReconnect();
    }
  }

  async restoreSubscriptions() {
    for (const [channel, handler] of this.subscriptions) {
      try {
        await this.client.subscribe(channel);
        this.client.on('message', (msg) => {
          if (msg.topic === channel) {
            handler(msg);
          }
        });
      } catch (error) {
        console.error(`恢复订阅失败: ${channel}`, error);
      }
    }
  }
}

// ❌ 避免的做法
// 不要在每次组件渲染时创建新的socket连接
// 不要忘记在组件卸载时清理连接
```

### 2. 错误处理

```javascript
// ✅ 完善的错误处理
async function safePublish(topic, payload, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await publish(topic, payload);
      return;
    } catch (error) {
      console.warn(`发布失败，第${i + 1}次重试:`, error);
      
      if (i === retries - 1) {
        // 最后一次失败，记录到本地存储
        saveFailedMessage(topic, payload);
        throw error;
      }
      
      // 指数退避
      await delay(Math.pow(2, i) * 1000);
    }
  }
}
```

### 3. 内存管理

```javascript
// ✅ 适当的清理
class MessageBuffer {
  constructor(maxSize = 100) {
    this.messages = [];
    this.maxSize = maxSize;
  }

  addMessage(message) {
    this.messages.push(message);
    
    // 保持缓冲区大小
    if (this.messages.length > this.maxSize) {
      this.messages.shift();
    }
  }

  clear() {
    this.messages = [];
  }
}
```

### 4. 用户体验优化

```javascript
// 离线缓存
class OfflineMessageQueue {
  constructor() {
    this.queue = this.loadFromStorage();
  }

  async add(topic, payload) {
    this.queue.push({ topic, payload, timestamp: Date.now() });
    this.saveToStorage();
  }

  async flush(publishFunction) {
    const messages = [...this.queue];
    this.queue = [];
    this.saveToStorage();

    for (const msg of messages) {
      try {
        await publishFunction(msg.topic, msg.payload);
      } catch (error) {
        // 重新加入队列
        this.queue.push(msg);
      }
    }
  }

  loadFromStorage() {
    try {
      return JSON.parse(localStorage.getItem('offline_messages') || '[]');
    } catch {
      return [];
    }
  }

  saveToStorage() {
    localStorage.setItem('offline_messages', JSON.stringify(this.queue));
  }
}
```

---

## 📚 API参考

### 客户端事件

| 事件名 | 参数 | 描述 |
|--------|------|------|
| `subscribe` | `{ topic, messageId, timestamp }` | 订阅频道 |
| `unsubscribe` | `{ topic, messageId, timestamp }` | 取消订阅 |
| `publish` | `{ topic, payload, messageId, ackRequired }` | 发布消息 |
| `heartbeat` | `{ timestamp }` | 心跳检测 |

### 服务器事件

| 事件名 | 参数 | 描述 |
|--------|------|------|
| `connected` | `{ connectionId, timestamp, user }` | 连接建立确认 |
| `message` | `{ id, topic, type, payload, timestamp, from, seq }` | 频道消息 |
| `notification` | `{ id, type, level, message, timestamp }` | 系统通知 |
| `ack` | `{ id, type, status, error? }` | 操作确认 |
| `heartbeat_ack` | `{ timestamp }` | 心跳确认 |

### 错误代码

| 错误代码 | 描述 | 处理建议 |
|----------|------|----------|
| `connection_not_found` | 连接不存在 | 重新建立连接 |
| `permission_denied` | 权限不足 | 检查用户权限 |
| `channel_not_found` | 频道不存在 | 确认频道名称 |
| `invalid_message` | 消息格式错误 | 检查消息格式 |
| `rate_limited` | 频率限制 | 降低发送频率 |

---

## 🎯 示例项目

完整的示例项目可以参考：

```bash
git clone https://github.com/bmt-platform/realtime-examples
cd realtime-examples
npm install
npm start
```

示例包含：
- 💬 聊天室应用
- 📊 实时数据监控
- 🔔 通知系统
- 👥 协作编辑器

---

**最后更新**: 2024-01-01  
**版本**: v1.0.0  
**状态**: 生产就绪

有问题或建议？请查阅 [常见问题](./FAQ.md) 或联系技术支持。

