import logger from '../utils/logger.js';

/**
 * HTTP请求日志中间件
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // 记录请求开始
  logger.request(req, 'Incoming Request');
  
  // 监听响应结束
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // 记录响应
    logger.response(req, res, responseTime);
    
    // 性能监控
    if (responseTime > 1000) {
      logger.performance('Slow Response', {
        method: req.method,
        url: req.url,
        responseTime: `${responseTime}ms`,
        requestId: req.headers['x-request-id']
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * 错误日志中间件
 */
export const errorLogger = (err, req, res, next) => {
  // 记录错误详情
  logger.error('Request Error', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    },
    user: req.user ? {
      userId: req.user.userId,
      role: req.user.role
    } : null,
    requestId: req.headers['x-request-id'],
    timestamp: new Date().toISOString()
  });
  
  next(err);
};

/**
 * 安全事件日志中间件
 */
export const securityLogger = (event) => {
  return (req, res, next) => {
    logger.security(event, {
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      headers: {
        'x-forwarded-for': req.get('X-Forwarded-For'),
        'x-real-ip': req.get('X-Real-IP')
      },
      requestId: req.headers['x-request-id'],
      timestamp: new Date().toISOString()
    });
    
    next();
  };
};

/**
 * 限流日志中间件
 */
export const rateLimitLogger = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    if (res.statusCode === 429) {
      logger.security('Rate Limit Exceeded', {
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        url: req.url,
        method: req.method,
        requestId: req.headers['x-request-id'],
        rateLimitInfo: {
          limit: res.get('X-RateLimit-Limit'),
          remaining: res.get('X-RateLimit-Remaining'),
          reset: res.get('X-RateLimit-Reset')
        }
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

