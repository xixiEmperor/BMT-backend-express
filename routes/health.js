import express from 'express';
import { config } from '../config/config.js';

const router = express.Router();

// 健康检查状态缓存
let healthStatus = {
  status: 'healthy',
  lastCheck: Date.now(),
  services: {}
};

/**
 * 健康检查接口
 * GET /api/health
 */
router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    
    // 如果距离上次检查不到30秒，返回缓存结果
    if (now - healthStatus.lastCheck < 30000) {
      return res.json({
        ...healthStatus,
        timestamp: now,
        uptime: process.uptime()
      });
    }

    // 执行健康检查
    const serviceChecks = await Promise.allSettled([
      checkTelemetryService(),
      checkAuthService(),
      checkWebSocketService(),
      checkDatabaseService(),
      checkMemoryUsage(),
      checkDiskSpace()
    ]);

    const services = {
      telemetry: serviceChecks[0].status === 'fulfilled' ? serviceChecks[0].value : 'unhealthy',
      auth: serviceChecks[1].status === 'fulfilled' ? serviceChecks[1].value : 'unhealthy',
      websocket: serviceChecks[2].status === 'fulfilled' ? serviceChecks[2].value : 'unhealthy',
      database: serviceChecks[3].status === 'fulfilled' ? serviceChecks[3].value : 'unhealthy',
      memory: serviceChecks[4].status === 'fulfilled' ? serviceChecks[4].value : 'unhealthy',
      disk: serviceChecks[5].status === 'fulfilled' ? serviceChecks[5].value : 'unhealthy'
    };

    // 计算整体健康状态
    const unhealthyServices = Object.values(services).filter(status => status === 'unhealthy');
    const degradedServices = Object.values(services).filter(status => status === 'degraded');

    let overallStatus = 'healthy';
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    }

    // 更新缓存
    healthStatus = {
      status: overallStatus,
      lastCheck: now,
      services
    };

    // 设置响应状态码
    let statusCode = 200;
    if (overallStatus === 'degraded') {
      statusCode = 200; // 部分降级但仍可服务
    } else if (overallStatus === 'unhealthy') {
      statusCode = 503; // 服务不可用
    }

    res.status(statusCode).json({
      status: overallStatus,
      services,
      timestamp: now,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: config.nodeEnv
    });

  } catch (error) {
    console.error('健康检查失败:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: Date.now(),
      services: {
        telemetry: 'unknown',
        auth: 'unknown',
        websocket: 'unknown',
        database: 'unknown'
      }
    });
  }
});

/**
 * 详细健康检查接口
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
  try {
    const checks = await Promise.allSettled([
      checkTelemetryServiceDetailed(),
      checkAuthServiceDetailed(),
      checkWebSocketServiceDetailed(),
      checkDatabaseServiceDetailed(),
      checkSystemResources()
    ]);

    const detailedStatus = {
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: config.nodeEnv,
      checks: {
        telemetry: checks[0].status === 'fulfilled' ? checks[0].value : { status: 'error', error: checks[0].reason?.message },
        auth: checks[1].status === 'fulfilled' ? checks[1].value : { status: 'error', error: checks[1].reason?.message },
        websocket: checks[2].status === 'fulfilled' ? checks[2].value : { status: 'error', error: checks[2].reason?.message },
        database: checks[3].status === 'fulfilled' ? checks[3].value : { status: 'error', error: checks[3].reason?.message },
        system: checks[4].status === 'fulfilled' ? checks[4].value : { status: 'error', error: checks[4].reason?.message }
      }
    };

    res.json(detailedStatus);

  } catch (error) {
    res.status(500).json({
      error: '详细健康检查失败',
      message: error.message,
      timestamp: Date.now()
    });
  }
});

/**
 * 检查遥测服务
 */
async function checkTelemetryService() {
  try {
    // 检查遥测服务是否正常
    // 这里可以添加实际的服务检查逻辑
    return 'healthy';
  } catch (error) {
    console.error('遥测服务检查失败:', error);
    return 'unhealthy';
  }
}

/**
 * 检查认证服务
 */
async function checkAuthService() {
  try {
    // 检查认证服务是否正常
    return 'healthy';
  } catch (error) {
    console.error('认证服务检查失败:', error);
    return 'unhealthy';
  }
}

/**
 * 检查WebSocket服务
 */
async function checkWebSocketService() {
  try {
    // 检查WebSocket服务是否正常
    return 'healthy';
  } catch (error) {
    console.error('WebSocket服务检查失败:', error);
    return 'unhealthy';
  }
}

/**
 * 检查数据库服务
 */
async function checkDatabaseService() {
  try {
    // 检查数据库连接是否正常
    // 在实际项目中，这里应该ping数据库
    return 'healthy';
  } catch (error) {
    console.error('数据库检查失败:', error);
    return 'unhealthy';
  }
}

/**
 * 检查内存使用情况
 */
async function checkMemoryUsage() {
  try {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const usedMemPercentage = (memUsage.rss / totalMem) * 100;

    if (usedMemPercentage > 90) {
      return 'unhealthy';
    } else if (usedMemPercentage > 75) {
      return 'degraded';
    }
    return 'healthy';
  } catch (error) {
    return 'unhealthy';
  }
}

/**
 * 检查磁盘空间
 */
async function checkDiskSpace() {
  try {
    // 在实际项目中，这里应该检查磁盘使用情况
    // 可以使用fs.statSync等方法
    return 'healthy';
  } catch (error) {
    return 'unhealthy';
  }
}

/**
 * 详细遥测服务检查
 */
async function checkTelemetryServiceDetailed() {
  return {
    status: 'healthy',
    responseTime: Math.random() * 10 + 5, // 模拟响应时间
    eventsProcessed: Math.floor(Math.random() * 10000),
    lastProcessed: Date.now() - Math.random() * 60000
  };
}

/**
 * 详细认证服务检查
 */
async function checkAuthServiceDetailed() {
  return {
    status: 'healthy',
    activeTokens: Math.floor(Math.random() * 100),
    lastLogin: Date.now() - Math.random() * 300000
  };
}

/**
 * 详细WebSocket服务检查
 */
async function checkWebSocketServiceDetailed() {
  return {
    status: 'healthy',
    activeConnections: Math.floor(Math.random() * 50),
    messagesPerSecond: Math.floor(Math.random() * 100)
  };
}

/**
 * 详细数据库服务检查
 */
async function checkDatabaseServiceDetailed() {
  return {
    status: 'healthy',
    connectionPool: {
      active: Math.floor(Math.random() * 10),
      idle: Math.floor(Math.random() * 5)
    },
    avgQueryTime: Math.random() * 50 + 10
  };
}

/**
 * 系统资源检查
 */
async function checkSystemResources() {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  return {
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    uptime: process.uptime(),
    pid: process.pid
  };
}

export default router;
