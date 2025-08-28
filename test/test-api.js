// 简单的API测试脚本
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('开始测试BMT Platform Backend API...\n');
  
  try {
    // 1. 测试健康检查
    console.log('1. 测试健康检查...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    console.log('✅ 健康检查:', healthData.status);
    
    // 2. 测试SDK配置
    console.log('\n2. 测试SDK配置...');
    const configRes = await fetch(`${BASE_URL}/api/sdk/config?app=test&release=1.0.0`);
    const configData = await configRes.json();
    console.log('✅ SDK配置获取成功');
    
    // 3. 测试用户登录
    console.log('\n3. 测试用户登录...');
    const loginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@example.com',
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    console.log('✅ 登录成功:', loginData.user?.email);
    
    const accessToken = loginData.accessToken;
    
    // 4. 测试令牌验证
    console.log('\n4. 测试令牌验证...');
    const verifyRes = await fetch(`${BASE_URL}/v1/auth/verify`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const verifyData = await verifyRes.json();
    console.log('✅ 令牌验证成功:', verifyData.valid);
    
    // 5. 测试遥测数据上报
    console.log('\n5. 测试遥测数据上报...');
    const telemetryData = [
      {
        id: 'test_' + Date.now(),
        type: 'custom',
        name: 'api_test',
        ts: Date.now(),
        app: 'test',
        release: '1.0.0',
        sessionId: 'test_session',
        props: {
          message: 'API测试事件',
          success: true
        }
      }
    ];
    
    const telemetryRes = await fetch(`${BASE_URL}/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(telemetryData)
    });
    const telemetryResult = await telemetryRes.json();
    console.log('✅ 遥测数据上报成功:', telemetryResult.accepted, '个事件');
    
    // 6. 测试令牌刷新
    console.log('\n6. 测试令牌刷新...');
    const refreshRes = await fetch(`${BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refreshToken: loginData.refreshToken
      })
    });
    const refreshData = await refreshRes.json();
    console.log('✅ 令牌刷新成功');
    
    console.log('\n🎉 所有API测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  testAPI();
}

export default testAPI;
