import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // 服务器配置
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // 数据库配置
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bmt-backend'
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN) || 3600,
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN) || 604800
  },
  
  // CORS配置
  cors: {
    origin: '*',
    credentials: true
  },
  
  // 限流配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    telemetryMax: parseInt(process.env.TELEMETRY_RATE_LIMIT_MAX) || 1000,
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 60
  },
  
  // Socket.IO配置
  socketio: {
    pingTimeout: parseInt(process.env.SOCKETIO_PING_TIMEOUT) || 60000,
    pingInterval: parseInt(process.env.SOCKETIO_PING_INTERVAL) || 25000
  },
  
  // 遥测配置
  telemetry: {
    maxEventsPerBatch: parseInt(process.env.TELEMETRY_MAX_EVENTS_PER_BATCH) || 200,
    maxEventSizeKB: parseInt(process.env.TELEMETRY_MAX_EVENT_SIZE_KB) || 10
  }
};
