# BMT Platform 日志系统使用指南

## 📋 概述

BMT Platform 集成了基于 Winston 的企业级日志系统，提供结构化日志记录、日志轮转、分级日志和实时监控功能。本文档详细介绍如何使用和配置日志系统。

---

## 🚀 功能特性

### ✨ 核心功能
- **分级日志**: error、warn、info、http、debug 五个级别
- **日志轮转**: 按日期自动轮转，设置文件大小和保留时间
- **结构化记录**: JSON格式，便于分析和查询
- **多输出目标**: 控制台、文件、错误文件分离
- **自定义格式**: 彩色控制台输出，JSON文件存储
- **异常捕获**: 自动记录未捕获异常和Promise拒绝

### 📁 日志文件结构

```
logs/
├── combined-YYYY-MM-DD.log     # 综合日志（所有级别）
├── access-YYYY-MM-DD.log       # HTTP访问日志
├── error-YYYY-MM-DD.log        # 错误日志（仅error级别）
├── exceptions-YYYY-MM-DD.log   # 未捕获异常
├── rejections-YYYY-MM-DD.log   # Promise拒绝
└── .audit/                     # 日志轮转审计文件
    ├── combined-audit.json
    ├── access-audit.json
    └── error-audit.json
```

---

## 📝 日志级别

### 级别定义

| 级别 | 数值 | 用途 | 示例 |
|------|------|------|------|
| **error** | 0 | 错误信息 | 系统错误、异常 |
| **warn** | 1 | 警告信息 | 安全事件、性能警告 |
| **info** | 2 | 一般信息 | 业务操作、状态变化 |
| **http** | 3 | HTTP请求 | API请求响应 |
| **debug** | 4 | 调试信息 | 开发调试、详细跟踪 |

### 环境配置
- **开发环境**: 显示 debug 及以上级别
- **生产环境**: 显示 info 及以上级别

---

## 🔧 基础使用

### 导入日志器

```javascript
import logger from '../utils/logger.js';
```

### 基础日志方法

```javascript
// 基础日志
logger.error('系统错误信息');
logger.warn('警告信息');
logger.info('一般信息');
logger.debug('调试信息');

// 带上下文的日志
logger.error('数据库连接失败', {
  database: 'users',
  host: 'localhost:5432',
  error: error.message
});

logger.info('用户登录', {
  userId: 'user_123',
  ip: '192.168.1.100',
  timestamp: Date.now()
});
```

---

## 🎯 专用日志方法

### 1. HTTP请求日志

```javascript
// 记录HTTP请求
logger.request(req, '用户访问首页');

// 记录HTTP响应（包含响应时间）
logger.response(req, res, responseTime);
```

**自动字段**:
- `method`: HTTP方法
- `url`: 请求URL
- `ip`: 客户端IP
- `userAgent`: 用户代理
- `requestId`: 请求ID
- `userId`: 用户ID（如果已认证）
- `statusCode`: 响应状态码
- `responseTime`: 响应时间

### 2. 认证相关日志

```javascript
// 登录事件
logger.auth('User Login', {
  username: 'admin@example.com',
  ip: '192.168.1.100',
  success: true,
  method: 'password'
});

// 令牌操作
logger.auth('Token Refresh', {
  userId: 'user_123',
  tokenType: 'refresh',
  expiresIn: 3600
});

// 权限检查
logger.auth('Permission Check', {
  userId: 'user_123',
  resource: '/admin/users',
  action: 'read',
  granted: false
});
```

### 3. 遥测数据日志

```javascript
// 事件处理
logger.telemetry('Events Processed', {
  count: 25,
  types: { page: 10, custom: 15 },
  processingTime: '120ms',
  errors: 0
});

// 数据验证
logger.telemetry('Validation Failed', {
  eventType: 'custom',
  field: 'timestamp',
  value: 'invalid',
  rule: 'must be number'
});

// 性能指标
logger.telemetry('Batch Processing', {
  batchSize: 100,
  duration: '250ms',
  throughput: '400 events/sec'
});
```

### 4. 实时通信日志

```javascript
// 连接管理
logger.realtime('User Connected', {
  userId: 'user_123',
  connectionId: 'conn_456',
  totalConnections: 25
});

// 频道操作
logger.realtime('Channel Subscribe', {
  userId: 'user_123',
  channel: 'public:chat',
  subscriberCount: 10
});

// 消息传递
logger.realtime('Message Published', {
  userId: 'user_123',
  channel: 'public:notifications',
  messageId: 'msg_789',
  deliveredTo: 15
});
```

### 5. 安全事件日志

```javascript
// 安全警告
logger.security('Suspicious Login', {
  username: 'admin@example.com',
  ip: '192.168.1.100',
  attempts: 3,
  timeWindow: '5 minutes'
});

// 限流事件
logger.security('Rate Limit Exceeded', {
  ip: '192.168.1.100',
  endpoint: '/api/login',
  limit: 60,
  window: '60 seconds'
});

// 权限违规
logger.security('Access Denied', {
  userId: 'user_123',
  resource: '/admin/config',
  reason: 'insufficient_permissions'
});
```

### 6. 性能监控日志

```javascript
// 慢查询
logger.performance('Slow Database Query', {
  query: 'SELECT * FROM users WHERE...',
  duration: '1500ms',
  threshold: '1000ms'
});

// API响应时间
logger.performance('API Response Time', {
  endpoint: '/api/users',
  method: 'GET',
  duration: '250ms',
  threshold: '200ms'
});

// 内存使用
logger.performance('Memory Usage', {
  heapUsed: '45MB',
  heapTotal: '60MB',
  percentage: 75
});
```

---

## 🛠️ 高级用法

### 子Logger创建

```javascript
import { createChildLogger } from '../utils/logger.js';

// 为特定模块创建子logger
const authLogger = createChildLogger('auth');
const telemetryLogger = createChildLogger('telemetry');

// 使用子logger（会自动包含module字段）
authLogger.info('用户认证成功', { userId: '123' });
// 输出: { module: 'auth', message: '用户认证成功', userId: '123' }
```

### 条件日志

```javascript
// 只在开发环境记录调试信息
if (process.env.NODE_ENV === 'development') {
  logger.debug('调试信息', { data: complexObject });
}

// 只在错误级别记录敏感信息
const logLevel = logger.level;
if (logLevel === 'error') {
  logger.error('包含敏感信息的错误', { 
    sensitiveData: '...' 
  });
}
```

### 性能监控

```javascript
// 函数执行时间监控
function measureTime(fn, name) {
  return async (...args) => {
    const start = Date.now();
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      
      logger.performance(`Function Execution: ${name}`, {
        duration: `${duration}ms`,
        success: true
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.performance(`Function Execution: ${name}`, {
        duration: `${duration}ms`,
        success: false,
        error: error.message
      });
      
      throw error;
    }
  };
}

// 使用示例
const timedFunction = measureTime(async (data) => {
  // 业务逻辑
  return processData(data);
}, 'processData');
```

---

## 📊 日志分析

### 1. 日志查询示例

```bash
# 查看今天的错误日志
cat logs/error-$(date +%Y-%m-%d).log | jq '.'

# 查找特定用户的操作
grep "user_123" logs/combined-$(date +%Y-%m-%d).log | jq '.'

# 统计API调用次数
grep "HTTP Request" logs/access-$(date +%Y-%m-%d).log | jq '.url' | sort | uniq -c

# 查看最近的安全事件
grep "Security:" logs/combined-$(date +%Y-%m-%d).log | tail -10 | jq '.'

# 分析性能问题
grep "Performance:" logs/combined-$(date +%Y-%m-%d).log | jq 'select(.duration | tonumber > 1000)'
```

### 2. 日志聚合脚本

```javascript
// analyze-logs.js
import fs from 'fs';
import path from 'path';

class LogAnalyzer {
  constructor(logDir = './logs') {
    this.logDir = logDir;
  }

  // 分析今日错误
  analyzeTodayErrors() {
    const today = new Date().toISOString().split('T')[0];
    const errorFile = path.join(this.logDir, `error-${today}.log`);
    
    if (!fs.existsSync(errorFile)) {
      console.log('今日无错误日志');
      return;
    }

    const logs = fs.readFileSync(errorFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    const errorCounts = logs.reduce((acc, log) => {
      const key = log.message || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    console.log('今日错误统计:', errorCounts);
  }

  // 分析API性能
  analyzeAPIPerformance() {
    const today = new Date().toISOString().split('T')[0];
    const accessFile = path.join(this.logDir, `access-${today}.log`);
    
    if (!fs.existsSync(accessFile)) {
      console.log('今日无访问日志');
      return;
    }

    const logs = fs.readFileSync(accessFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .filter(log => log.responseTime);

    const avgResponseTime = logs.reduce((sum, log) => {
      return sum + parseInt(log.responseTime);
    }, 0) / logs.length;

    const slowRequests = logs.filter(log => 
      parseInt(log.responseTime) > 1000
    );

    console.log(`平均响应时间: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`慢请求数量: ${slowRequests.length}`);
  }
}

const analyzer = new LogAnalyzer();
analyzer.analyzeTodayErrors();
analyzer.analyzeAPIPerformance();
```

---

## ⚙️ 配置选项

### 日志轮转配置

```javascript
// utils/logger.js 中的配置
new DailyRotateFile({
  filename: 'logs/combined-%DATE%.log',
  datePattern: 'YYYY-MM-DD',        // 日期格式
  maxSize: '20m',                   // 单文件最大20MB
  maxFiles: '7d',                   // 保留7天
  auditFile: 'logs/.audit/combined-audit.json'
});
```

### 环境变量配置

```bash
# .env 文件
LOG_LEVEL=info                    # 日志级别
LOG_MAX_SIZE=20m                  # 最大文件大小
LOG_MAX_FILES=7d                  # 文件保留时间
LOG_COLORIZE=true                 # 控制台彩色输出
LOG_JSON=true                     # JSON格式输出
```

### 生产环境优化

```javascript
// 生产环境配置
const productionTransports = [
  // 只输出error到控制台
  new winston.transports.Console({
    level: 'error',
    format: winston.format.simple()
  }),
  
  // 文件输出保留更长时间
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    maxSize: '50m',
    maxFiles: '30d'
  }),
  
  // 错误日志保留更长时间
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    level: 'error',
    maxSize: '20m',
    maxFiles: '90d'
  })
];
```

---

## 🔍 监控和告警

### 1. 日志监控脚本

```javascript
// log-monitor.js
import fs from 'fs';
import { exec } from 'child_process';

class LogMonitor {
  constructor() {
    this.watchers = new Map();
  }

  // 监控错误日志
  watchErrors(callback) {
    const today = new Date().toISOString().split('T')[0];
    const errorFile = `logs/error-${today}.log`;
    
    if (fs.existsSync(errorFile)) {
      const watcher = fs.watchFile(errorFile, () => {
        // 读取最新的错误
        const content = fs.readFileSync(errorFile, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        const lastError = lines[lines.length - 1];
        
        if (lastError) {
          try {
            const errorData = JSON.parse(lastError);
            callback(errorData);
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      });
      
      this.watchers.set('error', watcher);
    }
  }

  // 监控安全事件
  watchSecurity(callback) {
    const today = new Date().toISOString().split('T')[0];
    const combinedFile = `logs/combined-${today}.log`;
    
    // 使用tail -f监控文件
    const tail = exec(`tail -f ${combinedFile}`);
    
    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      
      lines.forEach(line => {
        if (line.includes('Security:')) {
          try {
            const logData = JSON.parse(line);
            callback(logData);
          } catch (e) {
            // 忽略JSON解析错误
          }
        }
      });
    });

    this.watchers.set('security', tail);
  }

  // 停止监控
  stopWatching() {
    this.watchers.forEach((watcher, key) => {
      if (key === 'security') {
        watcher.kill();
      } else {
        fs.unwatchFile(watcher);
      }
    });
    this.watchers.clear();
  }
}

// 使用示例
const monitor = new LogMonitor();

monitor.watchErrors((error) => {
  console.log('🚨 检测到新错误:', error.message);
  // 发送告警通知
  sendAlert('error', error);
});

monitor.watchSecurity((security) => {
  console.log('🔐 检测到安全事件:', security.event);
  // 发送安全告警
  sendSecurityAlert(security);
});
```

### 2. 告警集成

```javascript
// alerts.js
export async function sendAlert(type, data) {
  // 钉钉/企业微信通知
  await fetch('https://oapi.dingtalk.com/robot/send?access_token=...', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'text',
      text: {
        content: `[${type.toUpperCase()}] ${data.message}\n时间: ${new Date(data.timestamp).toLocaleString()}`
      }
    })
  });

  // 邮件通知
  await sendEmail({
    to: 'admin@company.com',
    subject: `系统告警: ${type}`,
    body: JSON.stringify(data, null, 2)
  });
}
```

---

## 📋 最佳实践

### 1. 日志内容规范

```javascript
// ✅ 好的日志记录
logger.info('用户操作', {
  action: 'update_profile',
  userId: 'user_123',
  changes: ['email', 'name'],
  ip: '192.168.1.100',
  userAgent: 'Mozilla/5.0...',
  timestamp: Date.now(),
  success: true
});

// ❌ 避免的做法
logger.info('用户更新了资料'); // 缺少上下文
logger.info(JSON.stringify(user)); // 可能包含敏感信息
```

### 2. 敏感信息处理

```javascript
// 敏感信息脱敏
function sanitizeUserData(user) {
  return {
    ...user,
    password: '[REDACTED]',
    creditCard: user.creditCard ? `****${user.creditCard.slice(-4)}` : undefined,
    email: user.email ? user.email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined
  };
}

logger.info('用户数据更新', {
  user: sanitizeUserData(user),
  operation: 'update'
});
```

### 3. 性能考虑

```javascript
// 避免在高频操作中记录debug日志
function processEvents(events) {
  // ❌ 避免
  events.forEach(event => {
    logger.debug('处理事件', { event });
    // 处理逻辑
  });

  // ✅ 推荐
  logger.info('批量处理事件', {
    count: events.length,
    types: getEventTypes(events)
  });
  
  events.forEach(event => {
    // 处理逻辑
  });
}
```

### 4. 错误上下文

```javascript
// 记录完整的错误上下文
try {
  await processUserData(userData);
} catch (error) {
  logger.error('用户数据处理失败', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context: {
      userId: userData.id,
      operation: 'process_user_data',
      timestamp: Date.now()
    },
    input: sanitizeUserData(userData)
  });
  
  throw error;
}
```

---

## 🚀 部署建议

### 日志文件管理

```bash
# 创建日志轮转定时任务
# /etc/logrotate.d/bmt-platform
/path/to/bmt-platform/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 app app
    postrotate
        # 重启应用或发送信号
        systemctl reload bmt-platform
    endscript
}
```

### 日志中心化

```javascript
// 发送到ELK Stack
import winston from 'winston';
import 'winston-elasticsearch';

const esTransport = new winston.transports.Elasticsearch({
  level: 'info',
  clientOpts: {
    host: 'elasticsearch:9200'
  },
  index: 'bmt-platform-logs'
});

logger.add(esTransport);
```

### 监控集成

```yaml
# Prometheus监控配置
# prometheus.yml
- job_name: 'bmt-platform-logs'
  static_configs:
    - targets: ['localhost:3000']
  metrics_path: '/metrics'
  scrape_interval: 30s
```

---

## 📞 故障排除

### 常见问题

1. **日志文件权限错误**
```bash
# 设置正确的权限
chmod 755 logs/
chmod 644 logs/*.log
```

2. **磁盘空间不足**
```bash
# 检查磁盘使用
df -h
du -sh logs/

# 清理旧日志
find logs/ -name "*.log" -mtime +30 -delete
```

3. **日志轮转失败**
```bash
# 检查轮转配置
cat logs/.audit/combined-audit.json

# 手动触发轮转
logrotate -f /etc/logrotate.d/bmt-platform
```

---

**最后更新**: 2024-01-01  
**版本**: v1.0.0  
**状态**: 生产就绪

更多信息请参考 [API文档](./API-Documentation.md) 和 [WebSocket集成指南](./WebSocket-Integration-Guide.md)。

