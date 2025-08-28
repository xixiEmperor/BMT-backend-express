import express from 'express';
import { config } from '../config/config.js';

const router = express.Router();

/**
 * 获取SDK配置
 * GET /api/sdk/config
 */
router.get('/config', (req, res) => {
  try {
    // 获取应用和版本信息（可以从查询参数或头部获取）
    const app = req.query.app || req.headers['x-sdk-app'] || 'default';
    const release = req.query.release || req.headers['x-sdk-release'] || '1.0.0';

    // 根据不同的应用和版本返回不同的配置
    const sdkConfig = {
      telemetry: {
        enabled: true,
        endpoint: '/v1/telemetry/ingest',
        sampleRate: getSampleRate(app, release),
        batchSize: 50,
        flushInterval: 5000, // 5秒
        maxEventSize: config.telemetry.maxEventSizeKB * 1024,
        maxBatchEvents: config.telemetry.maxEventsPerBatch
      },
      performance: {
        enabled: true,
        sampleRate: getPerformanceSampleRate(app, release),
        webVitals: true,
        endpoint: '/v1/telemetry/perf'
      },
      realtime: {
        enabled: true,
        url: getRealtimeUrl(req),
        heartbeatInterval: 30000, // 30秒
        reconnectDelay: 1000,
        maxReconnectAttempts: 5,
        namespace: '/rt'
      },
      features: getFeatureFlags(app, release),
      rateLimit: {
        telemetry: config.rateLimit.telemetryMax,
        auth: config.rateLimit.authMax,
        windowMs: config.rateLimit.windowMs
      },
      debug: config.nodeEnv === 'development'
    };

    // 设置缓存头（配置可以缓存一段时间）
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5分钟缓存

    res.json(sdkConfig);

  } catch (error) {
    res.status(500).json({
      error: '获取配置失败',
      message: error.message,
      requestId: req.headers['x-request-id']
    });
  }
});

/**
 * 获取采样率（可以根据应用和版本动态调整）
 */
function getSampleRate(app, release) {
  // 可以根据不同的应用设置不同的采样率
  const sampleRates = {
    'admin': 1.0,      // 管理后台全量采集
    'user': 0.1,       // 用户端10%采样
    'mobile': 0.05,    // 移动端5%采样
    'default': 0.1
  };

  return sampleRates[app] || sampleRates.default;
}

/**
 * 获取性能监控采样率
 */
function getPerformanceSampleRate(app, release) {
  // 性能监控通常需要更低的采样率
  const perfSampleRates = {
    'admin': 0.5,
    'user': 0.05,
    'mobile': 0.01,
    'default': 0.05
  };

  return perfSampleRates[app] || perfSampleRates.default;
}

/**
 * 获取实时通信服务地址
 */
function getRealtimeUrl(req) {
  const protocol = req.secure ? 'wss' : 'ws';
  const host = req.get('host');
  return `${protocol}://${host}`;
}

/**
 * 获取功能开关配置
 */
function getFeatureFlags(app, release) {
  // 可以根据应用和版本控制功能开关
  const baseFeatures = {
    'errorReporting': true,
    'performanceMonitoring': true,
    'realtimeUpdates': true,
    'advancedAnalytics': false,
    'debugMode': config.nodeEnv === 'development'
  };

  // 管理后台开启所有功能
  if (app === 'admin') {
    return {
      ...baseFeatures,
      'advancedAnalytics': true,
      'adminDashboard': true
    };
  }

  // 移动端关闭一些高消耗功能
  if (app === 'mobile') {
    return {
      ...baseFeatures,
      'performanceMonitoring': false,
      'realtimeUpdates': false
    };
  }

  return baseFeatures;
}

/**
 * 更新SDK配置（管理员专用）
 * POST /api/sdk/config
 */
router.post('/config', async (req, res) => {
  try {
    // 这里应该验证管理员权限
    // const token = req.headers.authorization;
    // await verifyAdminPermission(token);

    const { app, config: newConfig } = req.body;

    if (!app || !newConfig) {
      return res.status(400).json({
        error: '缺少必要参数',
        message: '需要提供app和config参数',
        requestId: req.headers['x-request-id']
      });
    }

    // 在实际项目中，这里应该保存到数据库
    console.log(`更新应用 ${app} 的配置:`, newConfig);

    res.json({
      success: true,
      message: '配置更新成功',
      app,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id']
    });

  } catch (error) {
    res.status(500).json({
      error: '更新配置失败',
      message: error.message,
      requestId: req.headers['x-request-id']
    });
  }
});

export default router;
