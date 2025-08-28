/**
 * BMT Platform Backend 综合测试脚本
 * 测试所有主要功能和API端点
 */

// Node.js环境需要polyfill fetch
import fetch from 'node-fetch';
globalThis.fetch = fetch;

const BASE_URL = 'http://localhost:5000';

// 简单的HTTP请求函数
async function request(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.text();
  
  try {
    return {
      status: response.status,
      ok: response.ok,
      data: JSON.parse(data)
    };
  } catch {
    return {
      status: response.status,
      ok: response.ok,
      data: data
    };
  }
}

async function runTests() {
  console.log('🧪 开始 BMT Platform Backend 综合测试\n');
  
  let passed = 0;
  let failed = 0;

  // 测试函数
  const test = async (name, testFn) => {
    try {
      console.log(`📋 测试: ${name}`);
      await testFn();
      console.log(`✅ ${name} - 通过\n`);
      passed++;
    } catch (error) {
      console.log(`❌ ${name} - 失败: ${error.message}\n`);
      failed++;
    }
  };

  // 1. 服务基础测试
  await test('服务健康检查', async () => {
    const res = await request(`${BASE_URL}/api/health`);
    if (!res.ok) throw new Error(`健康检查失败: ${res.status}`);
    if (res.data.status !== 'healthy' && res.data.status !== 'degraded') {
      throw new Error(`服务状态异常: ${res.data.status}`);
    }
    console.log(`   服务状态: ${res.data.status}`);
  });

  await test('根路径接口', async () => {
    const res = await request(`${BASE_URL}/`);
    if (!res.ok) throw new Error(`根路径访问失败: ${res.status}`);
    if (!res.data.name || !res.data.endpoints) {
      throw new Error('根路径响应格式错误');
    }
    console.log(`   服务名称: ${res.data.name}`);
  });

  // 2. SDK配置测试
  await test('SDK配置获取', async () => {
    const res = await request(`${BASE_URL}/api/sdk/config?app=test&release=1.0.0`);
    if (!res.ok) throw new Error(`配置获取失败: ${res.status}`);
    if (!res.data.telemetry || !res.data.realtime) {
      throw new Error('配置格式错误');
    }
    console.log(`   遥测采样率: ${res.data.telemetry.sampleRate}`);
    console.log(`   实时通信: ${res.data.realtime.enabled ? '启用' : '禁用'}`);
  });

  // 3. 认证功能测试
  let accessToken = '';
  let refreshToken = '';

  await test('用户登录', async () => {
    const res = await request(`${BASE_URL}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@example.com',
        password: 'password123'
      })
    });
    
    if (!res.ok) throw new Error(`登录失败: ${res.status}`);
    if (!res.data.accessToken || !res.data.refreshToken) {
      throw new Error('登录响应格式错误');
    }
    
    accessToken = res.data.accessToken;
    refreshToken = res.data.refreshToken;
    console.log(`   用户角色: ${res.data.user.role}`);
    console.log(`   用户邮箱: ${res.data.user.email}`);
  });

  await test('令牌验证', async () => {
    const res = await request(`${BASE_URL}/v1/auth/verify`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!res.ok) throw new Error(`令牌验证失败: ${res.status}`);
    if (!res.data.valid) throw new Error('令牌无效');
    console.log(`   令牌有效期: ${new Date(res.data.expiresAt).toLocaleString()}`);
  });

  await test('令牌刷新', async () => {
    const res = await request(`${BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });
    
    if (!res.ok) throw new Error(`令牌刷新失败: ${res.status}`);
    if (!res.data.accessToken) throw new Error('刷新响应格式错误');
    console.log(`   新令牌过期时间: ${res.data.expiresIn}秒`);
  });

  // 4. 遥测数据测试
  await test('单个事件上报', async () => {
    const event = {
      id: 'test_' + Date.now(),
      type: 'custom',
      name: 'test_event',
      ts: Date.now(),
      app: 'test-app',
      release: '1.0.0',
      sessionId: 'test_session_' + Date.now(),
      props: {
        testType: 'single_event',
        success: true
      }
    };

    const res = await request(`${BASE_URL}/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([event])
    });
    
    if (!res.ok) throw new Error(`事件上报失败: ${res.status}`);
    if (!res.data.success || res.data.processed !== 1) {
      throw new Error('事件处理失败');
    }
    console.log(`   处理事件数: ${res.data.processed}`);
  });

  await test('批量事件上报', async () => {
    const events = [];
    for (let i = 0; i < 5; i++) {
      events.push({
        id: `batch_test_${Date.now()}_${i}`,
        type: 'custom',
        name: 'batch_test',
        ts: Date.now() + i,
        app: 'test-app',
        release: '1.0.0',
        sessionId: 'batch_session_' + Date.now(),
        props: { batchIndex: i }
      });
    }

    const res = await request(`${BASE_URL}/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(events)
    });
    
    if (!res.ok) throw new Error(`批量上报失败: ${res.status}`);
    if (res.data.processed !== 5) throw new Error('批量处理数量错误');
    console.log(`   批量处理事件数: ${res.data.processed}`);
  });

  await test('重复事件幂等性', async () => {
    const eventId = 'duplicate_test_' + Date.now();
    const event = {
      id: eventId,
      type: 'custom',
      name: 'duplicate_test',
      ts: Date.now(),
      app: 'test-app',
      release: '1.0.0',
      sessionId: 'duplicate_session',
      props: { isDuplicate: true }
    };

    // 第一次上报
    const res1 = await request(`${BASE_URL}/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([event])
    });

    // 第二次上报相同事件
    const res2 = await request(`${BASE_URL}/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([event])
    });
    
    if (!res1.ok || !res2.ok) throw new Error('重复事件测试失败');
    console.log(`   第一次处理: ${res1.data.processed}, 第二次重复: ${res2.data.duplicates || 'N/A'}`);
  });

  // 5. 性能专用接口测试
  await test('性能数据上报', async () => {
    const perfEvent = {
      id: 'perf_test_' + Date.now(),
      type: 'perf',
      name: 'LCP',
      ts: Date.now(),
      app: 'test-app',
      release: '1.0.0',
      sessionId: 'perf_session',
      props: {
        value: 1250,
        rating: 'good',
        entryType: 'largest-contentful-paint'
      }
    };

    const res = await request(`${BASE_URL}/v1/telemetry/perf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([perfEvent])
    });
    
    if (!res.ok) throw new Error(`性能数据上报失败: ${res.status}`);
    console.log(`   性能事件处理: ${res.data.processed || 'N/A'}`);
  });

  // 6. 错误处理测试
  await test('无效数据处理', async () => {
    const res = await request(`${BASE_URL}/v1/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ invalid: 'data' }])
    });
    
    if (res.status !== 400) throw new Error('应该返回400错误');
    console.log(`   正确返回错误码: ${res.status}`);
  });

  await test('认证失败处理', async () => {
    const res = await request(`${BASE_URL}/v1/auth/verify`, {
      headers: { 'Authorization': 'Bearer invalid_token' }
    });
    
    if (res.status !== 401) throw new Error('应该返回401错误');
    console.log(`   正确返回认证错误: ${res.status}`);
  });

  // 7. 统计信息测试
  await test('遥测统计信息', async () => {
    const res = await request(`${BASE_URL}/v1/telemetry/stats`);
    if (!res.ok) throw new Error(`统计信息获取失败: ${res.status}`);
    console.log(`   事件总数: ${res.data.data?.totalEvents || 'N/A'}`);
  });

  await test('实时服务统计', async () => {
    const res = await request(`${BASE_URL}/api/realtime/stats`);
    if (!res.ok) throw new Error(`实时服务统计失败: ${res.status}`);
    console.log(`   活跃连接: ${res.data.data?.connections || 0}`);
    console.log(`   活跃频道: ${res.data.data?.channels || 0}`);
  });

  // 测试结果汇总
  console.log('📊 测试结果汇总:');
  console.log(`✅ 通过: ${passed} 个测试`);
  console.log(`❌ 失败: ${failed} 个测试`);
  console.log(`📈 成功率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 所有测试都通过了！BMT Platform Backend 工作正常。');
  } else {
    console.log(`\n⚠️  有 ${failed} 个测试失败，请检查相关功能。`);
  }

  return { passed, failed };
}

export default runTests;

// 如果是直接执行
if (import.meta.url.includes(process.argv[1].replace(/\\/g, '/'))) {
  runTests().catch(console.error);
}
