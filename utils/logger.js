import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config/config.js';

// 日志级别配置
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// 日志颜色配置
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(logColors);

// 自定义格式化
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// 控制台格式化
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let logMessage = `${timestamp} [${level}]: ${message}`;
    
    // 添加元数据
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// 创建传输器
const transports = [];

// 控制台输出
transports.push(
  new winston.transports.Console({
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
    format: consoleFormat
  })
);

// 文件输出 - 错误日志
transports.push(
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '30d',
    auditFile: 'logs/.audit/error-audit.json'
  })
);

// 文件输出 - 组合日志
transports.push(
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '7d',
    auditFile: 'logs/.audit/combined-audit.json'
  })
);

// 文件输出 - HTTP访问日志
transports.push(
  new DailyRotateFile({
    filename: 'logs/access-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'http',
    format: logFormat,
    maxSize: '20m',
    maxFiles: '7d',
    auditFile: 'logs/.audit/access-audit.json'
  })
);

// 创建Logger实例
const logger = winston.createLogger({
  levels: logLevels,
  level: config.nodeEnv === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports,
  exitOnError: false
});

// 处理未捕获的异常和Promise拒绝
if (config.nodeEnv !== 'test') {
  logger.exceptions.handle(
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  );

  logger.rejections.handle(
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  );
}

// 添加自定义方法
logger.request = (req, message = 'HTTP Request') => {
  logger.http(message, {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'],
    userId: req.user?.userId,
    timestamp: new Date().toISOString()
  });
};

logger.response = (req, res, responseTime) => {
  logger.http('HTTP Response', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    requestId: req.headers['x-request-id'],
    userId: req.user?.userId,
    contentLength: res.get('Content-Length'),
    timestamp: new Date().toISOString()
  });
};

logger.auth = (action, data = {}) => {
  logger.info(`Auth: ${action}`, {
    action,
    ...data,
    timestamp: new Date().toISOString()
  });
};

logger.telemetry = (action, data = {}) => {
  logger.info(`Telemetry: ${action}`, {
    action,
    ...data,
    timestamp: new Date().toISOString()
  });
};

logger.realtime = (action, data = {}) => {
  logger.info(`Realtime: ${action}`, {
    action,
    ...data,
    timestamp: new Date().toISOString()
  });
};

logger.security = (event, data = {}) => {
  logger.warn(`Security: ${event}`, {
    event,
    ...data,
    timestamp: new Date().toISOString(),
    severity: 'security'
  });
};

logger.performance = (metric, data = {}) => {
  logger.debug(`Performance: ${metric}`, {
    metric,
    ...data,
    timestamp: new Date().toISOString()
  });
};

// 创建子Logger
export const createChildLogger = (module) => {
  return logger.child({ module });
};

export default logger;

