import express from 'express';
import TelemetryService from '../services/telemetryService.js';
import { validateTelemetryBatch, validateEventSize } from '../schemas/telemetry.js';
import { telemetryRateLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config/config.js';

const router = express.Router();
const telemetryService = new TelemetryService();

/**
 * 遥测数据上报接口
 * POST /v1/telemetry/ingest
 */
router.post('/ingest', telemetryRateLimiter, async (req, res, next) => {
  try {
    // 检查Content-Type兼容性（支持sendBeacon的text/plain）
    const contentType = req.headers['content-type'];
    let events;

    if (contentType?.includes('text/plain')) {
      // sendBeacon可能使用text/plain
      try {
        events = JSON.parse(req.body);
      } catch (error) {
        return res.status(400).json({
          code: 'InvalidArgument',
          message: '无效的JSON格式',
          requestId: req.headers['x-request-id']
        });
      }
    } else {
      events = req.body;
    }

    // 验证请求体格式
    if (!Array.isArray(events)) {
      return res.status(400).json({
        code: 'InvalidArgument',
        message: '请求体必须是事件数组',
        requestId: req.headers['x-request-id']
      });
    }

    // 检查批次大小
    if (events.length === 0) {
      return res.status(400).json({
        code: 'InvalidArgument',
        message: '事件数组不能为空',
        requestId: req.headers['x-request-id']
      });
    }

    if (events.length > config.telemetry.maxEventsPerBatch) {
      return res.status(413).json({
        code: 'PayloadTooLarge',
        message: `事件数量超出限制：${events.length} > ${config.telemetry.maxEventsPerBatch}`,
        requestId: req.headers['x-request-id']
      });
    }

    // 验证每个事件的大小
    for (const event of events) {
      validateEventSize(event, config.telemetry.maxEventSizeKB);
    }

    // 验证事件数据结构
    const validatedEvents = validateTelemetryBatch(events);

    // 添加请求相关信息
    const enrichedEvents = validatedEvents.map(event => ({
      ...event,
      requestId: req.headers['x-request-id'],
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
      receivedAt: Date.now()
    }));

    // 保存事件
    const result = await telemetryService.saveEvents(enrichedEvents);

    // 设置响应头
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-RateLimit-Limit', config.rateLimit.telemetryMax);
    res.setHeader('X-RateLimit-Remaining', req.rateLimit?.remaining || 0);

    // 返回成功响应
    res.status(200).json({
      success: true,
      accepted: result.received,
      processed: result.processed,
      rejected: result.received - result.processed,
      duplicates: result.duplicates,
      requestId: req.headers['x-request-id'],
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 性能专用上报接口（可选）
 * POST /v1/telemetry/perf
 */
router.post('/perf', telemetryRateLimiter, async (req, res, next) => {
  try {
    const events = req.body;

    if (!Array.isArray(events)) {
      return res.status(400).json({
        code: 'InvalidArgument',
        message: '请求体必须是事件数组',
        requestId: req.headers['x-request-id']
      });
    }

    // 验证所有事件都是性能类型
    const invalidEvents = events.filter(event => event.type !== 'perf');
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        code: 'InvalidArgument',
        message: '性能接口只接受type=perf的事件',
        requestId: req.headers['x-request-id']
      });
    }

    // 复用主要的验证和处理逻辑
    req.body = events;
    req.url = '/ingest';
    
    // 转发到主要的ingest处理器
    return router.handle(req, res, next);

  } catch (error) {
    next(error);
  }
});

/**
 * 获取遥测服务统计信息（调试用）
 * GET /v1/telemetry/stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = telemetryService.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      requestId: req.headers['x-request-id']
    });
  }
});

export default router;
