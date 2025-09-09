import express from "express";
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';

// 配置和服务
import { config } from './config/config.js';
import RealtimeService from './services/realtimeService.js';

// 中间件
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import { requestLogger, errorLogger, rateLimitLogger } from './middleware/logging.js';
import logger from './utils/logger.js';

// 路由
import telemetryRoutes from './routes/telemetry.js';
import authRoutes from './routes/auth.js';
import configRoutes from './routes/config.js';
import healthRoutes from './routes/health.js';

const app = express();
const server = createServer(app);

// 初始化实时通信服务
const realtimeService = new RealtimeService();

// Socket.IO配置
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    credentials: config.cors.credentials
  },
  pingTimeout: config.socketio.pingTimeout,
  pingInterval: config.socketio.pingInterval
});

// 初始化实时服务
realtimeService.initialize(io);

// ========== 中间件配置 ==========

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: false, // 开发环境下禁用CSP
  crossOriginEmbedderPolicy: false
}));

// 请求ID中间件
app.use(requestIdMiddleware);

// 请求日志中间件
app.use(requestLogger);

// CORS配置
app.use(cors({
  origin: 'http://localhost:5173', // 指定前端域名，不要用通配符
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-Id',
    'X-SDK-App',
    'X-SDK-Release',
    'X-SDK-Version',
    // 添加CORS相关的headers
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '10mb' })); // 支持sendBeacon

// 限流日志中间件
app.use(rateLimitLogger);

// 全局限流
app.use(createRateLimiter({
  max: config.rateLimit.maxRequests,
  windowMs: config.rateLimit.windowMs
}));

// ========== 路由配置 ==========

// 健康检查（优先级最高，不受限流影响）
app.use('/api/health', healthRoutes);

// 遥测服务
app.use('/v1/telemetry', telemetryRoutes);

// 认证服务
app.use('/v1/auth', authRoutes);

// SDK配置服务
app.use('/api/sdk', configRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'BMT Platform Backend',
    version: '1.0.0',
    status: 'running',
    timestamp: Date.now(),
    endpoints: {
      telemetry: '/v1/telemetry/ingest',
      auth: '/v1/auth',
      config: '/api/sdk/config',
      health: '/api/health',
      realtime: 'ws://localhost:' + config.port
    }
  });
});

// 获取实时服务统计（调试用）
app.get('/api/realtime/stats', (req, res) => {
  try {
    const stats = realtimeService.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 系统广播接口（管理员用）
app.post('/api/realtime/broadcast', (req, res) => {
  try {
    const { level = 'info', message, targetUsers } = req.body;
    
    if (!message) {
      return res.status(400).json({
        success: false,
        error: '消息内容不能为空'
      });
    }

    realtimeService.broadcastSystemNotification(level, message, targetUsers);
    
    res.json({
      success: true,
      message: '广播发送成功',
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========== 错误处理 ==========

// 404处理
app.use(notFoundHandler);

// 错误日志中间件
app.use(errorLogger);

// 全局错误处理
app.use(errorHandler);

// ========== 启动服务器 ==========

// 清理任务
const cleanupInterval = setInterval(() => {
  try {
    realtimeService.cleanupStaleConnections();
  } catch (error) {
    console.error('清理任务失败:', error);
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 优雅关闭
const shutdown = () => {
  console.log('正在关闭服务器...');
  
  clearInterval(cleanupInterval);
  
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(config.port, () => {
  const startupInfo = {
    port: config.port,
    environment: config.nodeEnv,
    nodeVersion: process.version,
    pid: process.pid
  };

  logger.info('服务器启动成功', startupInfo);

  console.log('='.repeat(50));
  console.log(`🚀 BMT Platform Backend 已启动`);
  console.log(`📍 HTTP服务: http://localhost:${config.port}`);
  console.log(`🔗 WebSocket服务: ws://localhost:${config.port}`);
  console.log(`🌍 环境: ${config.nodeEnv}`);
  console.log(`📊 健康检查: http://localhost:${config.port}/api/health`);
  console.log(`📋 日志目录: ./logs/`);
  console.log('='.repeat(50));
  
  // 发送系统启动通知
  setTimeout(() => {
    realtimeService.broadcastSystemNotification(
      'info', 
      'BMT Platform Backend 服务已启动'
    );
  }, 1000);
});