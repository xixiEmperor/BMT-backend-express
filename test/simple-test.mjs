import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function runSimpleTests() {
  console.log('🧪 BMT Platform Backend 简单测试\n');
  
  try {
    // 1. 健康检查
    console.log('1. 测试健康检查...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    console.log(`✅ 健康检查: ${healthData.status}\n`);
    
    // 2. 用户登录
    console.log('2. 测试用户登录...');
    const loginRes = await fetch(`${BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@example.com',
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    console.log(`✅ 登录成功: ${loginData.user?.email}\n`);
    
    // 3. 遥测数据上报
    console.log('3. 测试遥测数据上报...');
    const telemetryRes = await fetch(`${BASE_URL}/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        id: 'test_' + Date.now(),
        type: 'custom',
        name: 'simple_test',
        ts: Date.now(),
        app: 'test',
        release: '1.0.0',
        sessionId: 'test_session',
        props: { message: '简单测试事件' }
      }])
    });
    const telemetryData = await telemetryRes.json();
    console.log(`✅ 遥测上报成功: ${telemetryData.processed} 个事件\n`);
    
    // 4. SDK配置
    console.log('4. 测试SDK配置...');
    const configRes = await fetch(`${BASE_URL}/api/sdk/config?app=test`);
    const configData = await configRes.json();
    console.log(`✅ SDK配置获取成功，采样率: ${configData.telemetry?.sampleRate}\n`);
    
    console.log('🎉 所有基础测试通过！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

runSimpleTests();
