# BMT Platform Backend API 接口文档

## 概述

BMT Platform Backend 提供完整的遥测数据收集、用户认证、实时通信和系统监控功能。本文档详细描述了所有对外接口，供前端开发人员对接使用。

**服务地址**: `http://localhost:5000`  
**WebSocket地址**: `ws://localhost:5000`  
**API版本**: v1.0.0

---

## 🚀 快速开始

### 基础配置

```javascript
const API_BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000';

// 通用请求头
const commonHeaders = {
  'Content-Type': 'application/json',
  'X-SDK-App': 'your-app-name',
  'X-SDK-Release': '1.0.0',
  'X-SDK-Version': 'sdk-version'
};
```

### 错误响应格式

所有API错误响应遵循统一格式：

```typescript
interface ErrorResponse {
  code: 'InvalidArgument' | 'Unauthorized' | 'Forbidden' | 'NotFound' | 
        'PayloadTooLarge' | 'RateLimited' | 'Internal' | 'ServiceUnavailable';
  message: string;
  details?: any;
  requestId: string;
}
```

### HTTP状态码说明

- `200`: 成功
- `400`: 参数错误
- `401`: 未授权/令牌过期
- `403`: 权限不足
- `404`: 资源不存在
- `413`: 请求体过大
- `429`: 请求过于频繁
- `500`: 服务器内部错误
- `503`: 服务不可用

---

## 📊 1. 遥测数据上报

### 1.1 批量事件上报

**接口**: `POST /v1/telemetry/ingest`  
**限流**: 1000请求/分钟  
**用途**: 批量上报遥测事件数据

#### 请求格式

```typescript
interface TelemetryEvent {
  id: string;                    // 事件唯一ID，最大100字符
  type: 'page' | 'custom' | 'error' | 'api' | 'perf' | 'event';
  name: string;                  // 事件名称，最大200字符
  ts: number;                    // 时间戳（毫秒）
  app: string;                   // 应用名称，最大50字符
  release: string;               // 版本号，最大20字符
  sessionId: string;             // 会话ID，最大100字符
  user?: {                       // 用户信息（可选）
    id: string | number;
    email?: string;
    name?: string;              // 最大100字符
    role?: string;              // 最大50字符
    attrs?: Record<string, any>;
  };
  props?: Record<string, any>;   // 事件属性
}

type TelemetryBatch = TelemetryEvent[];  // 1-200个事件
```

#### 请求示例

```javascript
const events = [
  {
    id: 'evt_' + Date.now(),
    type: 'page',
    name: '/dashboard',
    ts: Date.now(),
    app: 'my-app',
    release: '1.0.0',
    sessionId: 'sess_' + Date.now(),
    user: {
      id: 'user_123',
      email: 'user@example.com'
    },
    props: {
      url: 'https://app.example.com/dashboard',
      title: 'Dashboard',
      loadTime: 1200
    }
  },
  {
    id: 'evt_' + (Date.now() + 1),
    type: 'custom',
    name: 'button_click',
    ts: Date.now(),
    app: 'my-app',
    release: '1.0.0',
    sessionId: 'sess_' + Date.now(),
    props: {
      buttonId: 'save-btn',
      section: 'settings'
    }
  }
];

const response = await fetch('/v1/telemetry/ingest', {
  method: 'POST',
  headers: commonHeaders,
  body: JSON.stringify(events)
});
```

#### 响应格式

```typescript
interface TelemetryResponse {
  success: boolean;
  accepted: number;        // 接收到的事件数量
  processed: number;       // 成功处理的事件数量
  rejected: number;        // 拒绝的事件数量
  duplicates: number;      // 重复事件数量
  requestId: string;
  errors?: Array<{
    eventId: string;
    error: string;
  }>;
}
```

#### 事件类型详解

**页面浏览事件** (`type: 'page'`)
```javascript
{
  type: 'page',
  name: '/path/to/page',
  props: {
    url: '完整URL',
    title: '页面标题',
    referrer: '来源页面',
    loadTime: 1200,        // 页面加载时间(ms)
    query: {},             // URL查询参数
    hash: '#section'       // 页面锚点
  }
}
```

**自定义事件** (`type: 'custom'`)
```javascript
{
  type: 'custom',
  name: 'user_action',
  props: {
    action: 'button_click',
    target: 'save_button',
    value: 'success'
    // 任意自定义属性
  }
}
```

**错误事件** (`type: 'error'`)
```javascript
{
  type: 'error',
  name: 'javascript_error',
  props: {
    message: '错误消息',
    stack: '错误堆栈',
    filename: '文件名',
    lineno: 123,           // 行号
    colno: 45,             // 列号
    severity: 'error',     // 'error' | 'warning' | 'info'
    context: {}            // 错误上下文
  }
}
```

**API调用事件** (`type: 'api'`)
```javascript
{
  type: 'api',
  name: '/api/users',
  props: {
    method: 'POST',
    url: 'https://api.example.com/users',
    status: 200,
    duration: 350,         // 请求耗时(ms)
    success: true,
    requestSize: 1024,     // 请求大小(bytes)
    responseSize: 2048     // 响应大小(bytes)
  }
}
```

**性能事件** (`type: 'perf'`)
```javascript
{
  type: 'perf',
  name: 'LCP',             // 指标名称
  props: {
    value: 1250,           // 指标值
    rating: 'good',        // 'good' | 'needs-improvement' | 'poor'
    entryType: 'largest-contentful-paint',
    url: '/current/page'
  }
}
```

### 1.2 性能专用上报接口

**接口**: `POST /v1/telemetry/perf`  
**用途**: 专门用于性能数据上报，只接受 `type: 'perf'` 的事件

请求格式与 `/ingest` 相同，但会验证所有事件都为性能类型。

### 1.3 获取遥测统计

**接口**: `GET /v1/telemetry/stats`  
**用途**: 获取遥测服务统计信息（调试用）

```javascript
// 响应示例
{
  success: true,
  data: {
    totalEvents: 12340,
    bufferSize: 25,
    lastProcessed: "2024-01-01T12:00:00.000Z"
  },
  timestamp: 1704110400000
}
```

### 重要限制

- **批次大小**: 1-200个事件/请求
- **事件大小**: 每个事件最大10KB
- **请求体大小**: 最大10MB
- **限流**: 1000请求/分钟/IP
- **幂等性**: 相同ID的事件可重复提交，不会重复处理

---

## 🔐 2. 用户认证

### 2.1 用户登录

**接口**: `POST /v1/auth/login`  
**限流**: 60请求/分钟  
**用途**: 用户登录获取访问令牌

#### 请求格式

```typescript
interface LoginRequest {
  username: string;        // 用户名（邮箱）
  password: string;        // 密码
  fingerprint?: string;    // 设备指纹（可选）
}
```

#### 请求示例

```javascript
const response = await fetch('/v1/auth/login', {
  method: 'POST',
  headers: commonHeaders,
  body: JSON.stringify({
    username: 'admin@example.com',
    password: 'password123',
    fingerprint: 'device_fingerprint_hash'
  })
});
```

#### 响应格式

```typescript
interface LoginResponse {
  accessToken: string;     // JWT访问令牌
  refreshToken: string;    // 刷新令牌
  tokenType: 'Bearer';     // 令牌类型
  expiresIn: number;       // 过期时间（秒）
  user: {
    id: string;
    email: string;
    name: string;
    role: string;          // 用户角色
  };
  requestId: string;
}
```

### 2.2 刷新访问令牌

**接口**: `POST /v1/auth/refresh`  
**限流**: 60请求/分钟  
**用途**: 使用刷新令牌获取新的访问令牌

#### 请求格式

```typescript
interface RefreshRequest {
  refreshToken: string;    // 刷新令牌
  fingerprint?: string;    // 设备指纹（可选）
}
```

#### 请求示例

```javascript
const response = await fetch('/v1/auth/refresh', {
  method: 'POST',
  headers: commonHeaders,
  body: JSON.stringify({
    refreshToken: 'your_refresh_token_here'
  })
});
```

#### 响应格式

```typescript
interface RefreshResponse {
  accessToken: string;     // 新的JWT访问令牌
  tokenType: 'Bearer';
  expiresIn: number;       // 过期时间（秒）
  requestId: string;
}
```

### 2.3 验证访问令牌

**接口**: `GET /v1/auth/verify`  
**认证**: 需要Bearer Token  
**用途**: 验证当前访问令牌是否有效

#### 请求示例

```javascript
const response = await fetch('/v1/auth/verify', {
  headers: {
    ...commonHeaders,
    'Authorization': 'Bearer ' + accessToken
  }
});
```

#### 响应格式

```typescript
interface VerifyResponse {
  valid: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];  // 用户权限列表
  };
  expiresAt: number;       // 令牌过期时间戳
  requestId: string;
}
```

### 2.4 用户登出

**接口**: `POST /v1/auth/logout`  
**认证**: 需要Bearer Token  
**用途**: 撤销刷新令牌并登出

#### 请求示例

```javascript
const response = await fetch('/v1/auth/logout', {
  method: 'POST',
  headers: {
    ...commonHeaders,
    'Authorization': 'Bearer ' + accessToken
  },
  body: JSON.stringify({
    refreshToken: 'your_refresh_token'
  })
});
```

### 2.5 撤销所有令牌

**接口**: `POST /v1/auth/revoke-all`  
**认证**: 需要Bearer Token  
**用途**: 撤销用户的所有刷新令牌

### 2.6 获取用户会话

**接口**: `GET /v1/auth/sessions`  
**认证**: 需要Bearer Token  
**用途**: 获取用户的活跃会话列表

### 测试用户

系统内置了以下测试用户：

```javascript
// 管理员账户
{
  username: 'admin@example.com',
  password: 'password123',
  role: 'admin',
  permissions: ['telemetry:read', 'telemetry:write', 'admin:all']
}

// 普通用户
{
  username: 'user@example.com', 
  password: 'password123',
  role: 'user',
  permissions: ['telemetry:write']
}
```

---

## ⚙️ 3. SDK配置

### 3.1 获取SDK配置

**接口**: `GET /api/sdk/config`  
**缓存**: 5分钟  
**用途**: 获取前端SDK的动态配置

#### 请求参数

```typescript
interface ConfigParams {
  app?: string;           // 应用名称（查询参数或头部 X-SDK-App）
  release?: string;       // 版本号（查询参数或头部 X-SDK-Release）
}
```

#### 请求示例

```javascript
// 方式1：查询参数
const response = await fetch('/api/sdk/config?app=my-app&release=1.0.0');

// 方式2：请求头
const response = await fetch('/api/sdk/config', {
  headers: {
    'X-SDK-App': 'my-app',
    'X-SDK-Release': '1.0.0'
  }
});
```

#### 响应格式

```typescript
interface SDKConfig {
  telemetry: {
    enabled: boolean;        // 是否启用遥测
    endpoint: string;        // 上报端点
    sampleRate: number;      // 采样率 (0-1)
    batchSize: number;       // 批次大小
    flushInterval: number;   // 刷新间隔(ms)
    maxEventSize: number;    // 单个事件最大大小(bytes)
    maxBatchEvents: number;  // 批次最大事件数
  };
  performance: {
    enabled: boolean;        // 是否启用性能监控
    sampleRate: number;      // 性能采样率
    webVitals: boolean;      // 是否收集Web Vitals
    endpoint: string;        // 性能数据端点
  };
  realtime: {
    enabled: boolean;        // 是否启用实时通信
    url: string;             // WebSocket地址
    heartbeatInterval: number;    // 心跳间隔(ms)
    reconnectDelay: number;       // 重连延迟(ms)
    maxReconnectAttempts: number; // 最大重连次数
    namespace: string;            // Socket.IO命名空间
  };
  features: {
    errorReporting: boolean;      // 错误上报
    performanceMonitoring: boolean; // 性能监控
    realtimeUpdates: boolean;     // 实时更新
    advancedAnalytics: boolean;   // 高级分析
    debugMode: boolean;           // 调试模式
  };
  rateLimit: {
    telemetry: number;       // 遥测接口限流
    auth: number;            // 认证接口限流
    windowMs: number;        // 限流窗口(ms)
  };
  debug: boolean;            // 是否为调试模式
}
```

#### 应用配置差异

不同应用类型会返回不同的配置：

```javascript
// 管理后台 (app: 'admin')
{
  telemetry: { sampleRate: 1.0 },      // 全量采集
  performance: { sampleRate: 0.5 },
  features: { 
    advancedAnalytics: true,
    adminDashboard: true 
  }
}

// 用户端 (app: 'user') 
{
  telemetry: { sampleRate: 0.1 },      // 10%采样
  performance: { sampleRate: 0.05 }
}

// 移动端 (app: 'mobile')
{
  telemetry: { sampleRate: 0.05 },     // 5%采样
  performance: { 
    enabled: false,                    // 关闭性能监控
    sampleRate: 0.01 
  },
  features: {
    performanceMonitoring: false,
    realtimeUpdates: false             // 关闭实时更新
  }
}
```

### 3.2 更新SDK配置

**接口**: `POST /api/sdk/config`  
**权限**: 需要管理员权限  
**用途**: 更新指定应用的SDK配置

---

## 🏥 4. 健康检查

### 4.1 基础健康检查

**接口**: `GET /api/health`  
**缓存**: 30秒  
**用途**: 获取服务整体健康状态

#### 响应格式

```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    telemetry: 'healthy' | 'degraded' | 'unhealthy';
    auth: 'healthy' | 'degraded' | 'unhealthy';
    websocket: 'healthy' | 'degraded' | 'unhealthy';
    database: 'healthy' | 'degraded' | 'unhealthy';
    memory: 'healthy' | 'degraded' | 'unhealthy';
    disk: 'healthy' | 'degraded' | 'unhealthy';
  };
  timestamp: number;
  uptime: number;          // 服务运行时间(秒)
  version: string;         // 服务版本
  nodeVersion: string;     // Node.js版本
  environment: string;     // 运行环境
}
```

#### 状态说明

- **healthy**: 所有服务正常
- **degraded**: 部分服务降级，但仍可提供服务
- **unhealthy**: 服务不可用

### 4.2 详细健康检查

**接口**: `GET /api/health/detailed`  
**用途**: 获取详细的健康检查信息

返回更详细的服务状态和系统资源信息。

---

## 🔄 5. 实时通信 (WebSocket)

### 5.1 连接建立

#### 连接示例

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:5000', {
  auth: {
    token: 'Bearer ' + accessToken  // 必须提供有效的访问令牌
  },
  transports: ['websocket']
});

// 连接成功
socket.on('connected', (data) => {
  console.log('连接成功:', data);
  // data: { connectionId, timestamp, user: { id, role } }
});

// 连接错误
socket.on('connect_error', (error) => {
  console.error('连接失败:', error.message);
});
```

### 5.2 频道订阅

#### 订阅频道

```javascript
const messageId = 'sub_' + Date.now();

socket.emit('subscribe', {
  topic: 'public:notifications',  // 频道名称
  messageId: messageId           // 消息ID（用于ACK）
}, (response) => {
  if (response.status === 'success') {
    console.log('订阅成功:', response);
  } else {
    console.error('订阅失败:', response.error);
  }
});
```

#### 取消订阅

```javascript
socket.emit('unsubscribe', {
  topic: 'public:notifications',
  messageId: 'unsub_' + Date.now()
}, (response) => {
  console.log('取消订阅:', response);
});
```

### 5.3 消息发布

```javascript
socket.emit('publish', {
  topic: 'public:chat',
  payload: {
    message: 'Hello World!',
    timestamp: Date.now()
  },
  messageId: 'pub_' + Date.now(),
  ackRequired: true              // 是否需要ACK确认
}, (response) => {
  if (response.status === 'success') {
    console.log('消息发布成功:', response);
  }
});
```

### 5.4 接收消息

```javascript
// 接收频道消息
socket.on('message', (data) => {
  console.log('收到消息:', data);
  /*
  data: {
    id: 'msg_123',
    topic: 'public:chat', 
    type: 'event',
    payload: { message: 'Hello' },
    timestamp: 1704110400000,
    from: 'user_123',
    seq: 42
  }
  */
});

// 接收系统通知
socket.on('notification', (notification) => {
  console.log('系统通知:', notification);
  /*
  notification: {
    id: 'notif_123',
    type: 'notification',
    level: 'info',           // 'info' | 'warning' | 'error'
    message: '系统消息内容',
    timestamp: 1704110400000
  }
  */
});

// 接收ACK确认
socket.on('ack', (ack) => {
  console.log('收到ACK:', ack);
  /*
  ack: {
    id: 'original_message_id',
    type: 'ack',
    status: 'success' | 'error',
    error?: 'error message'
  }
  */
});
```

### 5.5 心跳保活

```javascript
// 发送心跳
setInterval(() => {
  socket.emit('heartbeat', {
    timestamp: Date.now()
  });
}, 30000);

// 接收心跳确认
socket.on('heartbeat_ack', (data) => {
  console.log('心跳确认:', data.timestamp);
});
```

### 5.6 频道类型和权限

#### 频道命名规范

- **公共频道**: `public:channel-name` - 所有用户可访问
- **私有频道**: `private:channel-name` - 需要特定权限
- **用户频道**: `user:${userId}` - 用户专属频道
- **系统频道**: `system:notifications` - 系统通知频道

#### 权限说明

- **管理员**: 对所有频道有完全访问权限
- **普通用户**: 
  - 可以访问所有公共频道
  - 可以访问自己的用户频道 (`user:${userId}`)
  - 可以订阅系统频道，但不能发布
  - 需要特定权限才能访问私有频道

### 5.7 错误处理

```javascript
// 监听错误事件
socket.on('error', (error) => {
  console.error('Socket错误:', error);
});

// 断开连接处理
socket.on('disconnect', (reason) => {
  console.log('连接断开:', reason);
  
  // 自动重连逻辑
  if (reason === 'io server disconnect') {
    // 服务器主动断开，需要重新连接
    socket.connect();
  }
});
```

---

## 📈 6. 其他接口

### 6.1 服务信息

**接口**: `GET /`  
**用途**: 获取服务基本信息

```javascript
// 响应示例
{
  name: 'BMT Platform Backend',
  version: '1.0.0', 
  status: 'running',
  timestamp: 1704110400000,
  endpoints: {
    telemetry: '/v1/telemetry/ingest',
    auth: '/v1/auth',
    config: '/api/sdk/config',
    health: '/api/health',
    realtime: 'ws://localhost:5000'
  }
}
```

### 6.2 实时服务统计

**接口**: `GET /api/realtime/stats`  
**用途**: 获取WebSocket服务统计信息

### 6.3 系统广播

**接口**: `POST /api/realtime/broadcast`  
**权限**: 需要管理员权限  
**用途**: 向所有或指定用户发送系统广播

```javascript
// 请求示例
{
  level: 'info',           // 'info' | 'warning' | 'error'
  message: '系统维护通知',
  targetUsers: ['user1', 'user2']  // 可选，不提供则广播给所有用户
}
```

---

## 🛡️ 安全和限流

### 全局限流

- **通用接口**: 1000请求/分钟/IP
- **遥测接口**: 1000请求/分钟/IP  
- **认证接口**: 60请求/分钟/IP

### 安全特性

1. **CORS配置**: 支持指定域名的跨域访问
2. **安全头**: 使用Helmet中间件设置安全HTTP头
3. **请求大小限制**: 请求体最大10MB
4. **令牌安全**: JWT令牌带有过期时间，支持刷新机制
5. **请求跟踪**: 每个请求都有唯一的Request ID

### 响应头

所有响应都会包含以下头部：

```
X-Request-Id: req_1704110400000_abc123
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
Cache-Control: no-store  (遥测接口)
```

---

## 🧪 测试和调试

### 运行测试

```bash
# 启动服务
npm run dev

# 运行简单测试
node test/simple-test.mjs

# 运行综合测试  
node test/comprehensive-test.js
```

### 调试模式

在开发环境下 (`NODE_ENV=development`)：
- SDK配置中 `debug: true`
- 错误响应包含堆栈信息
- 更详细的日志输出

### 常用调试接口

```javascript
// 获取遥测统计
GET /v1/telemetry/stats

// 获取认证统计（需要管理员权限）
GET /v1/auth/stats

// 获取实时服务统计
GET /api/realtime/stats

// 健康检查
GET /api/health
```

---

## 📝 最佳实践

### 1. 遥测数据上报

```javascript
// ✅ 好的做法
const events = [];
// 批量收集事件
events.push(createPageEvent());
events.push(createClickEvent());

// 批量上报
if (events.length > 0) {
  await uploadTelemetry(events);
}

// ❌ 避免单个事件上报
await uploadTelemetry([singleEvent]); // 效率低
```

### 2. 错误处理

```javascript
// ✅ 完整的错误处理
try {
  const response = await fetch('/v1/telemetry/ingest', {
    method: 'POST',
    headers: commonHeaders,
    body: JSON.stringify(events)
  });
  
  if (!response.ok) {
    const error = await response.json();
    if (error.code === 'RateLimited') {
      // 处理限流，等待后重试
      await delay(error.retryAfter * 1000);
      return retry();
    }
    throw new Error(error.message);
  }
  
  return await response.json();
} catch (error) {
  console.error('遥测上报失败:', error);
  // 缓存到本地，稍后重试
}
```

### 3. 令牌管理

```javascript
// ✅ 自动令牌刷新
class AuthManager {
  async request(url, options = {}) {
    let token = this.getAccessToken();
    
    // 检查令牌是否即将过期
    if (this.isTokenExpiringSoon(token)) {
      token = await this.refreshToken();
    }
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
    
    // 处理401错误
    if (response.status === 401) {
      token = await this.refreshToken();
      // 重试请求
      return this.request(url, options);
    }
    
    return response;
  }
}
```

### 4. WebSocket重连

```javascript
// ✅ 健壮的WebSocket连接
class RealtimeClient {
  connect() {
    this.socket = io(WS_URL, {
      auth: { token: `Bearer ${this.getAccessToken()}` }
    });
    
    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });
    
    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        // 服务器主动断开，可能是令牌过期
        this.refreshTokenAndReconnect();
      }
    });
    
    this.socket.on('connect_error', () => {
      this.handleReconnect();
    });
  }
  
  async refreshTokenAndReconnect() {
    try {
      await this.authManager.refreshToken();
      this.socket.auth.token = `Bearer ${this.getAccessToken()}`;
      this.socket.connect();
    } catch (error) {
      // 刷新失败，重新登录
      this.redirectToLogin();
    }
  }
}
```

---

## 📞 技术支持

如有问题，请联系：

- **文档版本**: v1.0.0
- **最后更新**: 2024-01-01
- **API状态**: 生产就绪

**注意**: 本文档描述的是当前实现的功能。在生产环境中，建议：
1. 配置真实的数据库存储
2. 设置监控和日志系统
3. 配置HTTPS和WSS
4. 实施更严格的安全策略


