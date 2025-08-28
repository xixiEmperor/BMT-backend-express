/**
 * 日志系统测试
 */
import logger from '../utils/logger.js';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testLogging() {
  console.log('🧪 测试日志系统...\n');

  // 测试不同级别的日志
  logger.info('这是一条信息日志');
  logger.warn('这是一条警告日志');
  logger.error('这是一条错误日志');
  logger.debug('这是一条调试日志');

  // 测试结构化日志
  logger.auth('用户登录测试', {
    username: 'test@example.com',
    ip: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    success: true
  });

  logger.telemetry('事件处理测试', {
    eventCount: 5,
    processingTime: '120ms',
    types: { page: 2, custom: 3 }
  });

  logger.realtime('连接测试', {
    userId: 'user_123',
    connectionId: 'conn_456',
    action: 'connected'
  });

  logger.security('安全事件测试', {
    event: 'suspicious_login',
    ip: '192.168.1.100',
    attempts: 3
  });

  logger.performance('性能指标测试', {
    metric: 'response_time',
    value: '150ms',
    endpoint: '/api/test'
  });

  console.log('✅ 日志测试完成！查看 logs/ 目录下的日志文件');

  // 如果服务器正在运行，测试HTTP请求日志
  try {
    console.log('\n🌐 测试HTTP请求日志...');
    
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      console.log('✅ HTTP请求测试完成，查看access日志');
    }
  } catch (error) {
    console.log('ℹ️  服务器未运行，跳过HTTP测试');
  }
}

testLogging();

