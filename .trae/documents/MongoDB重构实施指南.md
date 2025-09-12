# MongoDB重构实施指南

## 1. 环境准备

### 1.1 安装MongoDB

```bash
# macOS使用Homebrew安装
brew tap mongodb/brew
brew install mongodb-community

# 启动MongoDB服务
brew services start mongodb/brew/mongodb-community

# 或者使用Docker运行
docker run -d --name mongodb -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:latest
```

### 1.2 更新项目依赖

```bash
# 安装MongoDB相关依赖
pnpm add mongoose bcryptjs
pnpm add -D @types/bcryptjs
```

### 1.3 环境变量配置

更新 `.env` 文件：
```env
# MongoDB配置
MONGODB_URI=mongodb://localhost:27017/bmt-backend
MONGODB_USER=admin
MONGODB_PASSWORD=password

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=3600
JWT_REFRESH_EXPIRES_IN=604800

# 其他配置保持不变
PORT=3000
NODE_ENV=development
```

## 2. 数据库连接配置

### 2.1 创建数据库连接模块

创建 `config/database.js`：
```javascript
import mongoose from 'mongoose';
import { config } from './config.js';
import logger from '../utils/logger.js';

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.connection = null;
  }

  /**
   * 连接MongoDB数据库
   */
  async connect() {
    try {
      // 设置Mongoose配置
      mongoose.set('strictQuery', false);
      
      // 连接选项
      const options = {
        maxPoolSize: 10, // 连接池最大连接数
        serverSelectionTimeoutMS: 5000, // 服务器选择超时
        socketTimeoutMS: 45000, // Socket超时
        bufferMaxEntries: 0, // 禁用缓冲
        bufferCommands: false, // 禁用命令缓冲
      };

      // 建立连接
      this.connection = await mongoose.connect(config.mongodb.uri, options);
      this.isConnected = true;

      logger.info('MongoDB连接成功', {
        host: this.connection.connection.host,
        port: this.connection.connection.port,
        database: this.connection.connection.name
      });

      // 监听连接事件
      this.setupEventListeners();

    } catch (error) {
      logger.error('MongoDB连接失败:', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB连接已建立');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB连接错误:', error);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB连接已断开');
      this.isConnected = false;
    });

    // 应用终止时关闭连接
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * 断开数据库连接
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB连接已关闭');
    } catch (error) {
      logger.error('关闭MongoDB连接失败:', error);
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }
}

export default new DatabaseConnection();
```

### 2.2 更新配置文件

更新 `config/config.js`：
```javascript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // 服务器配置
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // 数据库配置
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bmt-backend',
    user: process.env.MONGODB_USER,
    password: process.env.MONGODB_PASSWORD
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN) || 3600,
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 604800
  },
  
  // 其他配置保持不变...
  cors: {
    origin: '*',
    credentials: true
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    telemetryMax: parseInt(process.env.TELEMETRY_RATE_LIMIT_MAX) || 1000,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 60
  },
  
  socketio: {
    pingTimeout: parseInt(process.env.SOCKETIO_PING_TIMEOUT) || 60000,
    pingInterval: parseInt(process.env.SOCKETIO_PING_INTERVAL) || 25000
  },
  
  telemetry: {
    maxEventsPerBatch: parseInt(process.env.TELEMETRY_MAX_EVENTS_PER_BATCH) || 200,
    maxEventSizeKB: parseInt(process.env.TELEMETRY_MAX_EVENT_SIZE_KB) || 10
  }
};
```

## 3. 数据模型定义

### 3.1 创建模型目录结构

```bash
mkdir models
touch models/User.js
touch models/RefreshToken.js
touch models/TelemetryEvent.js
touch models/Connection.js
touch models/Channel.js
touch models/Subscription.js
touch models/Message.js
touch models/index.js
```

### 3.2 用户模型 (models/User.js)

```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, '邮箱是必需的'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址']
  },
  passwordHash: {
    type: String,
    required: [true, '密码是必需的'],
    minlength: [6, '密码至少6位']
  },
  name: {
    type: String,
    required: [true, '姓名是必需的'],
    trim: true,
    maxlength: [50, '姓名不能超过50个字符']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'user'],
      message: '角色必须是admin或user'
    },
    default: 'user'
  },
  permissions: [{
    type: String,
    enum: ['telemetry:read', 'telemetry:write', 'admin:all']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      return ret;
    }
  }
});

// 创建索引
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 实例方法：验证密码
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// 静态方法：根据邮箱查找用户
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

export default mongoose.model('User', userSchema);
```

### 3.3 刷新令牌模型 (models/RefreshToken.js)

```javascript
import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  fingerprint: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL索引，自动删除过期文档
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceInfo: String
  }
}, {
  timestamps: true
});

// 复合索引
refreshTokenSchema.index({ userId: 1, isActive: 1 });
refreshTokenSchema.index({ token: 1, isActive: 1 });

// 静态方法：查找有效令牌
refreshTokenSchema.statics.findValidToken = function(token) {
  return this.findOne({
    token,
    isActive: true,
    expiresAt: { $gt: new Date() }
  }).populate('userId');
};

// 实例方法：撤销令牌
refreshTokenSchema.methods.revoke = function() {
  this.isActive = false;
  return this.save();
};

export default mongoose.model('RefreshToken', refreshTokenSchema);
```

### 3.4 遥测事件模型 (models/TelemetryEvent.js)

```javascript
import mongoose from 'mongoose';

const telemetryEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: ['page', 'error', 'api', 'perf', 'custom', 'event'],
      message: '事件类型必须是page、error、api、perf、custom或event之一'
    },
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(v) {
        return v && typeof v === 'object';
      },
      message: '事件数据必须是对象类型'
    }
  },
  timestamp: {
    type: Number,
    required: true,
    index: true
  },
  processedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  requestId: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String,
    sdkVersion: String
  }
}, {
  timestamps: true
});

// 复合索引
telemetryEventSchema.index({ type: 1, timestamp: -1 });
telemetryEventSchema.index({ userId: 1, timestamp: -1 });
telemetryEventSchema.index({ createdAt: -1 });
telemetryEventSchema.index({ type: 1, createdAt: -1 });

// 静态方法：按类型查询事件
telemetryEventSchema.statics.findByType = function(type, limit = 100) {
  return this.find({ type })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// 静态方法：按时间范围查询
telemetryEventSchema.statics.findByTimeRange = function(startTime, endTime, options = {}) {
  const query = {
    timestamp: {
      $gte: startTime,
      $lte: endTime
    }
  };
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.userId) {
    query.userId = options.userId;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 1000);
};

// 静态方法：获取事件统计
telemetryEventSchema.statics.getEventStats = function(timeRange = 24 * 60 * 60 * 1000) {
  const startTime = Date.now() - timeRange;
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        latestTimestamp: { $max: '$timestamp' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

export default mongoose.model('TelemetryEvent', telemetryEventSchema);
```

### 3.5 连接模型 (models/Connection.js)

```javascript
import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  connectionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  socketId: {
    type: String,
    required: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    fingerprint: String,
    deviceInfo: String
  },
  connectedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  disconnectedAt: {
    type: Date,
    default: null
  },
  disconnectReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// 复合索引
connectionSchema.index({ userId: 1, isActive: 1 });
connectionSchema.index({ lastActivity: 1, isActive: 1 });

// 静态方法：查找活跃连接
connectionSchema.statics.findActiveConnections = function(userId = null) {
  const query = { isActive: true };
  if (userId) {
    query.userId = userId;
  }
  return this.find(query).populate('userId', 'name email role');
};

// 静态方法：清理过期连接
connectionSchema.statics.cleanupStaleConnections = function(timeoutMs = 5 * 60 * 1000) {
  const cutoffTime = new Date(Date.now() - timeoutMs);
  return this.updateMany(
    {
      isActive: true,
      lastActivity: { $lt: cutoffTime }
    },
    {
      $set: {
        isActive: false,
        disconnectedAt: new Date(),
        disconnectReason: 'timeout'
      }
    }
  );
};

// 实例方法：更新活跃时间
connectionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// 实例方法：断开连接
connectionSchema.methods.disconnect = function(reason = 'manual') {
  this.isActive = false;
  this.disconnectedAt = new Date();
  this.disconnectReason = reason;
  return this.save();
};

export default mongoose.model('Connection', connectionSchema);
```

### 3.6 模型导出文件 (models/index.js)

```javascript
import User from './User.js';
import RefreshToken from './RefreshToken.js';
import TelemetryEvent from './TelemetryEvent.js';
import Connection from './Connection.js';
import Channel from './Channel.js';
import Subscription from './Subscription.js';
import Message from './Message.js';

export {
  User,
  RefreshToken,
  TelemetryEvent,
  Connection,
  Channel,
  Subscription,
  Message
};

// 默认导出所有模型
export default {
  User,
  RefreshToken,
  TelemetryEvent,
  Connection,
  Channel,
  Subscription,
  Message
};
```

## 4. 服务层重构

### 4.1 认证服务重构 (services/authService.js)

```javascript
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/config.js';
import { User, RefreshToken } from '../models/index.js';
import logger from '../utils/logger.js';

/**
 * 认证服务类 - MongoDB版本
 */
class AuthService {
  constructor() {
    // 不再需要内存存储
  }

  /**
   * 用户认证
   */
  async authenticateUser(email, password) {
    try {
      logger.auth('Login Attempt', { email });
      
      // 查找用户
      const user = await User.findByEmail(email);
      if (!user) {
        logger.auth('Login Failed - User Not Found', { email });
        throw new Error('用户不存在');
      }

      // 检查用户是否激活
      if (!user.isActive) {
        logger.auth('Login Failed - User Inactive', { email, userId: user._id });
        throw new Error('用户账户已被禁用');
      }

      // 验证密码
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logger.auth('Login Failed - Invalid Password', { email, userId: user._id });
        throw new Error('密码错误');
      }

      // 更新最后登录时间
      user.lastLoginAt = new Date();
      await user.save();

      logger.auth('Login Success', { 
        email, 
        userId: user._id, 
        role: user.role 
      });
      
      return user;
    } catch (error) {
      logger.error('用户认证失败:', error);
      throw error;
    }
  }

  /**
   * 生成令牌对
   */
  async generateTokens(user, fingerprint = null, metadata = {}) {
    try {
      const payload = {
        userId: user._id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      };

      // 生成访问令牌
      const accessToken = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
      });

      // 生成刷新令牌
      const refreshTokenValue = uuidv4();
      const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresIn * 1000);

      // 保存刷新令牌到数据库
      const refreshToken = new RefreshToken({
        userId: user._id,
        token: refreshTokenValue,
        fingerprint,
        expiresAt,
        metadata: {
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
          deviceInfo: metadata.deviceInfo
        }
      });

      await refreshToken.save();
      
      logger.auth('Tokens Generated', { 
        userId: user._id, 
        fingerprint: fingerprint ? 'provided' : 'none'
      });

      return {
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: config.jwt.expiresIn,
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.error('生成令牌失败:', error);
      throw error;
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshTokenValue, fingerprint = null) {
    try {
      // 查找有效的刷新令牌
      const refreshToken = await RefreshToken.findValidToken(refreshTokenValue);
      if (!refreshToken) {
        throw new Error('刷新令牌无效或已过期');
      }

      // 验证设备指纹
      if (fingerprint && refreshToken.fingerprint && 
          refreshToken.fingerprint !== fingerprint) {
        throw new Error('设备验证失败');
      }

      const user = refreshToken.userId;
      if (!user || !user.isActive) {
        throw new Error('用户不存在或已被禁用');
      }

      // 更新令牌使用时间
      refreshToken.lastUsed = new Date();
      await refreshToken.save();

      // 生成新的访问令牌
      const payload = {
        userId: user._id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      };

      const accessToken = jwt.sign(payload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn
      });

      logger.auth('Token Refreshed', { userId: user._id });

      return {
        accessToken,
        expiresIn: config.jwt.expiresIn,
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.error('刷新令牌失败:', error);
      throw error;
    }
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.userId);
      
      if (!user || !user.isActive) {
        return {
          valid: false,
          error: '用户不存在或已被禁用'
        };
      }

      return {
        valid: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions
        },
        expiresAt: decoded.exp * 1000
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * 撤销刷新令牌
   */
  async revokeRefreshToken(refreshTokenValue) {
    try {
      const refreshToken = await RefreshToken.findOne({ 
        token: refreshTokenValue,
        isActive: true 
      });
      
      if (refreshToken) {
        await refreshToken.revoke();
        logger.auth('Refresh Token Revoked', { 
          userId: refreshToken.userId,
          tokenId: refreshToken._id 
        });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('撤销刷新令牌失败:', error);
      throw error;
    }
  }

  /**
   * 撤销用户所有刷新令牌
   */
  async revokeAllUserTokens(userId) {
    try {
      const result = await RefreshToken.updateMany(
        { userId, isActive: true },
        { $set: { isActive: false } }
      );
      
      logger.auth('All User Tokens Revoked', { 
        userId, 
        revokedCount: result.modifiedCount 
      });
      
      return result.modifiedCount;
    } catch (error) {
      logger.error('撤销用户所有令牌失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期令牌
   */
  async cleanupExpiredTokens() {
    try {
      const result = await RefreshToken.deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { isActive: false }
        ]
      });
      
      logger.info('过期令牌清理完成', { deletedCount: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      logger.error('清理过期令牌失败:', error);
      throw error;
    }
  }
}

export default new AuthService();
```

## 5. 应用启动配置

### 5.1 更新主应用文件 (app.js)

在现有的 `app.js` 文件开头添加数据库连接：

```javascript
import express from "express";
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';

// 数据库连接
import database from './config/database.js';

// 配置和服务
import { config } from './config/config.js';
import RealtimeService from './services/realtimeService.js';

// 其他导入保持不变...

const app = express();
const server = createServer(app);

// 连接数据库
try {
  await database.connect();
  console.log('数据库连接成功');
} catch (error) {
  console.error('数据库连接失败:', error);
  process.exit(1);
}

// 其余代码保持不变...
```

### 5.2 创建数据库初始化脚本

创建 `scripts/initDatabase.js`：

```javascript
import database from '../config/database.js';
import { User } from '../models/index.js';
import bcrypt from 'bcryptjs';

/**
 * 初始化数据库
 */
async function initDatabase() {
  try {
    // 连接数据库
    await database.connect();
    console.log('数据库连接成功');

    // 检查是否已有管理员用户
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('管理员用户已存在，跳过初始化');
      return;
    }

    // 创建默认管理员用户
    const adminUser = new User({
      email: 'admin@example.com',
      passwordHash: 'password123', // 会被pre-save中间件自动加密
      name: '系统管理员',
      role: 'admin',
      permissions: ['telemetry:read', 'telemetry:write', 'admin:all']
    });

    await adminUser.save();
    console.log('管理员用户创建成功:', adminUser.email);

    // 创建测试用户
    const testUser = new User({
      email: 'user@example.com',
      passwordHash: 'password123',
      name: '测试用户',
      role: 'user',
      permissions: ['telemetry:write']
    });

    await testUser.save();
    console.log('测试用户创建成功:', testUser.email);

    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  } finally {
    await database.disconnect();
    process.exit(0);
  }
}

// 运行初始化
initDatabase();
```

### 5.3 更新package.json脚本

在 `package.json` 中添加新的脚本：

```json
{
  "scripts": {
    "dev": "nodemon app.js",
    "start": "node app.js",
    "init-db": "node scripts/initDatabase.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

## 6. 迁移步骤

### 6.1 准备阶段

1. **备份现有数据**（如果有重要数据）
2. **安装MongoDB**并启动服务
3. **更新项目依赖**
4. **配置环境变量**

### 6.2 实施阶段

1. **创建数据库连接配置**
2. **定义数据模型**
3. **重构服务层**
4. **更新路由和中间件**
5. **测试功能**

### 6.3 验证阶段

1. **运行数据库初始化脚本**：
   ```bash
   pnpm run init-db
   ```

2. **启动应用**：
   ```bash
   pnpm run dev
   ```

3. **测试API接口**：
   ```bash
   # 测试用户登录
   curl -X POST http://localhost:3000/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@example.com","password":"password123"}'
   
   # 测试遥测数据接收
   curl -X POST http://localhost:3000/v1/telemetry/ingest \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{"events":[{"id":"test_001","type":"page","timestamp":1640995200000,"data":{"url":"/test"}}]}'
   ```

## 7. 注意事项

### 7.1 性能优化

- **合理使用索引**：为经常查询的字段创建索引
- **批量操作**：使用 `insertMany`、`updateMany` 等批量操作
- **连接池配置**：合理配置MongoDB连接池大小
- **查询优化**：使用 `lean()` 查询减少内存使用

### 7.2 错误处理

- **数据库连接错误**：实现重连机制
- **数据验证错误**：提供友好的错误信息
- **事务处理**：对于需要一致性的操作使用事务

### 7.3 监控和日志

- **数据库性能监控**：监控查询性能和连接状态
- **错误日志记录**：记录所有数据库操作错误
- **业务日志**：记录重要的业务操作

### 7.4 安全考虑

- **密码加密**：使用bcrypt加密用户密码
- **输入验证**：验证所有输入数据
- **权限控制**：实现基于角色的访问控制
- **SQL注入防护**：使用Mongoose的内置防护机制

这个实施指南提供了完整的MongoDB重构方案，确保了数据的持久化存储、业务逻辑的完整性，以及系统的可维护性。