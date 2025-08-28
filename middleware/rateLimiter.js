import rateLimit from 'express-rate-limit';
import { config } from '../config/config.js';

/**
 * 通用限流中间件
 */
export const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.maxRequests,
    message: {
      code: 'RateLimited',
      message: '请求过于频繁，请稍后再试',
      details: {
        resetTime: new Date(Date.now() + (options.windowMs || config.rateLimit.windowMs))
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        code: 'RateLimited',
        message: '请求过于频繁，请稍后再试',
        requestId: req.headers['x-request-id'],
        retryAfter: Math.ceil((options.windowMs || config.rateLimit.windowMs) / 1000)
      });
    }
  });
};

/**
 * 遥测接口专用限流
 */
export const telemetryRateLimiter = createRateLimiter({
  max: config.rateLimit.telemetryMax,
  windowMs: config.rateLimit.windowMs
});

/**
 * 认证接口专用限流
 */
export const authRateLimiter = createRateLimiter({
  max: config.rateLimit.authMax,
  windowMs: config.rateLimit.windowMs
});
