# BMT Platform Backend

基于Express.js和Socket.IO构建的BMT平台后端服务，提供遥测数据收集、用户认证和实时通信功能。

## 功能特性

### 🔍 遥测数据收集
- **批量事件上报**: 支持批量上报页面浏览、自定义事件、错误事件、API调用和性能数据
- **数据验证**: 严格的数据格式验证和大小限制
- **幂等性**: 防止重复事件处理
- **高性能**: 异步批处理，支持高并发请求

### 🔐 用户认证
- **JWT令牌**: 基于JWT的访问令牌和刷新令牌机制
- **令牌管理**: 支持令牌刷新、撤销和会话管理
- **权限控制**: 基于角色的权限验证

### 🔄 实时通信
- **Socket.IO**: 基于Socket.IO的WebSocket实时通信
- **频道订阅**: 支持公共频道、私有频道和用户专属频道
- **消息确认**: 可靠的消息传递和ACK机制
- **权限控制**: 基于用户角色的频道访问控制

### 📋 企业级日志系统
- **分级日志**: error、warn、info、http、debug 五个级别
- **日志轮转**: 按日期自动轮转，文件大小和保留时间控制
- **结构化记录**: JSON格式，便于分析和查询
- **专用日志**: 认证、遥测、实时通信、安全、性能专门记录
- **监控集成**: 支持日志监控和告警通知

### 🛡️ 安全与监控
- **限流保护**: API请求限流和防DDoS
- **CORS配置**: 灵活的跨域资源共享配置
- **健康检查**: 完整的服务健康监控
- **错误处理**: 统一的错误处理和日志记录
- **安全审计**: 完整的操作日志和安全事件记录

## 项目结构

```
BMT-backend-express/
├── config/
│   └── config.js              # 配置文件
├── middleware/
│   ├── auth.js                # 认证中间件
│   ├── rateLimiter.js         # 限流中间件
│   ├── errorHandler.js        # 错误处理中间件
│   └── logging.js             # 日志中间件
├── routes/
│   ├── telemetry.js           # 遥测数据路由
│   ├── auth.js                # 认证路由
│   ├── config.js              # SDK配置路由
│   └── health.js              # 健康检查路由
├── services/
│   ├── telemetryService.js    # 遥测数据服务
│   ├── authService.js         # 认证服务
│   └── realtimeService.js     # 实时通信服务
├── schemas/
│   ├── telemetry.js           # 遥测数据验证
│   └── auth.js                # 认证数据验证
├── utils/
│   └── logger.js              # 日志工具
├── docs/
│   ├── API-Documentation.md   # 完整API文档
│   ├── WebSocket-Integration-Guide.md  # WebSocket对接指南
│   └── Logging-System-Guide.md         # 日志系统指南
├── examples/
│   └── websocket-client.html  # WebSocket测试客户端
├── test/
│   ├── test-api.js            # API测试脚本
│   ├── test-logging.mjs       # 日志测试脚本
│   └── simple-test.mjs        # 简单功能测试
├── logs/                      # 日志文件目录
│   ├── combined-YYYY-MM-DD.log
│   ├── access-YYYY-MM-DD.log
│   ├── error-YYYY-MM-DD.log
│   └── .audit/               # 日志轮转审计
├── app.js                     # 主应用文件
├── package.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 2. 配置环境变量

创建 `.env` 文件并配置以下变量：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# JWT配置
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=3600
JWT_REFRESH_EXPIRES_IN=604800

# CORS配置
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# 限流配置
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000
TELEMETRY_RATE_LIMIT_MAX=1000
AUTH_RATE_LIMIT_MAX=60

# 遥测配置
TELEMETRY_MAX_EVENTS_PER_BATCH=200
TELEMETRY_MAX_EVENT_SIZE_KB=10
```

### 3. 启动服务

```bash
npm run dev
# 或
pnpm dev
```

服务将在 `http://localhost:3000` 上运行。

### 4. 测试API

```bash
node test/test-api.js
```

## API文档

### 遥测数据上报

#### POST /v1/telemetry/ingest

上报遥测事件数据：

```javascript
// 请求示例
[
  {
    "id": "evt_abc123",
    "type": "page",
    "name": "/dashboard",
    "ts": 1703123456789,
    "app": "my-app",
    "release": "1.0.0",
    "sessionId": "sess_xyz789",
    "user": {
      "id": "user_123",
      "email": "user@example.com"
    },
    "props": {
      "url": "https://app.example.com/dashboard",
      "title": "Dashboard"
    }
  }
]
```

### 用户认证

#### POST /v1/auth/login

用户登录获取令牌：

```javascript
{
  "username": "admin@example.com",
  "password": "password123"
}
```

#### POST /v1/auth/refresh

刷新访问令牌：

```javascript
{
  "refreshToken": "refresh_token_here"
}
```

#### GET /v1/auth/verify

验证访问令牌（需要Authorization头）。

### SDK配置

#### GET /api/sdk/config

获取SDK配置信息：

```javascript
// 响应示例
{
  "telemetry": {
    "enabled": true,
    "endpoint": "/v1/telemetry/ingest",
    "sampleRate": 1.0,
    "batchSize": 50,
    "flushInterval": 5000
  },
  "realtime": {
    "enabled": true,
    "url": "ws://localhost:3000",
    "heartbeatInterval": 30000
  }
}
```

### 健康检查

#### GET /api/health

获取服务健康状态：

```javascript
// 响应示例
{
  "status": "healthy",
  "services": {
    "telemetry": "healthy",
    "auth": "healthy",
    "websocket": "healthy"
  },
  "timestamp": 1703123456789,
  "uptime": 12345
}
```

## WebSocket实时通信

### 连接认证

```javascript
const socket = io('ws://localhost:3000', {
  auth: {
    token: 'Bearer your_access_token'
  }
});
```

### 订阅频道

```javascript
socket.emit('subscribe', {
  topic: 'public:notifications',
  messageId: 'sub_123'
}, (response) => {
  console.log('订阅结果:', response);
});
```

### 发布消息

```javascript
socket.emit('publish', {
  topic: 'public:chat',
  payload: { message: 'Hello World' },
  messageId: 'pub_123'
}, (response) => {
  console.log('发布结果:', response);
});
```

### 接收消息

```javascript
socket.on('message', (data) => {
  console.log('收到消息:', data);
});

socket.on('notification', (notification) => {
  console.log('系统通知:', notification);
});
```

## 频道类型

- **公共频道**: `public:channel-name` - 所有用户可访问
- **私有频道**: `private:channel-name` - 需要特定权限
- **用户频道**: `user:${userId}` - 用户专属频道
- **系统频道**: `system:notifications` - 系统通知频道

## 开发

### 添加新的遥测事件类型

1. 在 `schemas/telemetry.js` 中添加新的验证规则
2. 在 `services/telemetryService.js` 中添加处理逻辑
3. 更新API文档

### 添加新的API端点

1. 在 `routes/` 目录下创建新的路由文件
2. 在 `app.js` 中注册路由
3. 添加必要的中间件和验证

### 自定义权限控制

在 `services/realtimeService.js` 的 `hasPermission` 方法中自定义权限逻辑。

## 生产部署建议

1. **环境变量**: 使用强密钥和生产环境配置
2. **HTTPS**: 启用HTTPS和WSS
3. **数据库**: 配置持久化数据库存储
4. **监控**: 添加日志记录和监控系统
5. **负载均衡**: 配置反向代理和负载均衡
6. **安全**: 启用安全头和限流策略

## 📚 详细文档

- **[完整API文档](./docs/API-Documentation.md)** - 所有接口的详细说明和示例
- **[WebSocket集成指南](./docs/WebSocket-Integration-Guide.md)** - 实时通信功能前端对接详细指南  
- **[日志系统指南](./docs/Logging-System-Guide.md)** - 企业级日志系统使用和配置指南
- **[WebSocket测试客户端](./examples/websocket-client.html)** - 可直接使用的WebSocket测试工具

## 🚀 新功能亮点

### 📋 企业级日志系统
- 基于Winston的分级日志记录
- 自动日志轮转和文件管理
- 结构化日志，便于分析和监控
- 专门的认证、遥测、实时通信、安全、性能日志
- 支持日志监控和告警集成

### 🔄 完整的WebSocket解决方案
- 详细的前端对接文档和示例
- 完整的连接管理和错误处理
- 可视化的WebSocket测试客户端
- 支持React Hook封装和最佳实践

### 📊 全面的监控能力
- HTTP请求全链路跟踪
- 实时性能监控
- 安全事件记录和告警
- 完整的审计日志

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

ISC
