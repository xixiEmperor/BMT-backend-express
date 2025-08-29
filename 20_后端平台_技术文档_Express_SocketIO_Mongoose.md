# 平台后端技术文档（Express + Socket.IO + Mongoose）

> 目标：为前端中台 SDK（sdk-realtime/sd k-telemetry/sd k-perf/sd k-http）提供最小闭环后端支撑。你当前以“前端为主导”，本后端按需最简实现即可。

---

## 总览架构
- HTTP：Express
  - `POST /api/telemetry/batch`（可选）：接收遥测与性能批量事件
  - `POST /api/perf/batch`（可与上合并）：接收性能指标
  - `GET /healthz`：健康检查
- Realtime：Socket.IO（命名空间 `/realtime`）
  - 主题/房间：`orders:{shopId}`、`booking:{venueId}`、`notice:global` 等
  - 可靠性：ack/重发/序列号有序/反压/重连退避
- 数据层：MongoDB（Mongoose）
  - 起步可先写日志文件；后续补充模型与索引

## 环境与依赖
- Node 18+、pnpm 9
- 主要依赖：`express`、`socket.io`、`mongoose`、`zod`（校验，建议）

## 鉴权与安全
- 鉴权：Bearer Token（Header 或 `auth` 参数）；连接 `io.use((socket,next)=>{ ... })` 校验。
- CORS：限制来源、允许必要头与方法。
- 速率限制：
  - HTTP：`/api/*` 路由 Rate Limit（按 IP 或 userId）。
  - Socket.IO：每连接每秒消息上限、每主题上限。
- 输入校验：使用 zod 对 body/事件 payload 做 schema 校验。

## Socket.IO 设计

### 命名空间与房间
- 命名空间：`/realtime`
- 房间命名：`topic` 直用房间名，例如 `orders:123`、`notice:global`

### 事件模型（建议）
```ts
// 客户端 → 服务端
{ type: 'subscribe', topic: string }
{ type: 'unsubscribe', topic: string }
{ type: 'publish', topic: string, payload: any, id: string, seq?: number }

// 服务端 → 客户端
{ type: 'event', topic: string, payload: any, id: string, seq: number, ts: number }
{ type: 'ack', id: string }
{ type: 'error', code: string, message: string }
```

### 可靠性策略
- ack/重发：收到 `publish` 后广播 `event`，等待客户端 ack；超时重发（上限与间隔可配）。
- 序列有序：每个 `topic` 维护 `seq` 自增；客户端乱序丢弃或缓冲重排（权衡实现成本）。
- 反压：为每连接维护发送队列上限；超限丢弃并告警（或降级为合并批次）。
- 重连：指数退避；上线后自动重订阅。

### 伪代码（关键路径）
```ts
io.of('/realtime').use(authMiddleware)
.on('connection', (socket) => {
  socket.on('message', (msg) => {
    switch (msg.type) {
      case 'subscribe': socket.join(msg.topic); break
      case 'unsubscribe': socket.leave(msg.topic); break
      case 'publish': {
        const event = { type:'event', topic:msg.topic, payload:msg.payload, id:msg.id, seq: nextSeq(msg.topic), ts: Date.now() }
        io.of('/realtime').to(msg.topic).emit('message', event)
        // 可选：记录投递日志（供重放/审计）
        break
      }
    }
  })
})
```

## 遥测/性能接收（最小实现）

### 路由与校验
```ts
POST /api/telemetry/batch  // 可与 /api/perf/batch 合并
body: {
  app: string,
  release: string,
  events: Array<{ type:'page'|'event'|'error'|'api'|'perf', name:string, ts:number, props?:any }>
}
```
- 你已决定“不做脱敏/保留期”，后端只做基本校验与存储（或写入文件），后续随需加上报分析。

### Mongoose 模型（示例）
```ts
const TelemetrySchema = new Schema({
  app: String,
  release: String,
  type: String,
  name: String,
  ts: Number,
  props: Schema.Types.Mixed,
  user: Schema.Types.Mixed,
})
```

## 运维与扩展
- 进程：PM2 或 systemd；健康检查 `/healthz` 返回依赖检查结果（Mongo 可选）。
- 日志：结构化日志（JSON 行），记录关键事件（连接/订阅/错误）。
- 横向扩展：Socket.IO 使用 Redis Adapter 支持房间跨实例广播。
- 监控：进程指标（CPU/内存/事件速率/队列长度），便于容量规划。

## 与 SDK 的对接
- `sdk-realtime`：事件结构一致；服务端保证 ack/seq；客户端自动重订阅与去重。
- `sdk-telemetry` 与 `sdk-perf`：统一上报地址；可合并为一个批量端点；服务端仅做最简持久化。
- `sdk-http`：无需后端变更；但可在后端配合 `Retry-After`/`429` 进行前端限流。

## 本地开发脚手架（建议）
- `.env`：`PORT=8080`、`MONGO_URI=mongodb://localhost:27017/platform`
- `pnpm dev`：nodemon 热重载；同时起 Socket.IO 与 Express。
- `pnpm test`：契约测试（消息格式/ack 超时/HTTP 校验）。

## 风险与回退
- 实时广播风暴：加每连接/每主题限流；可对热点主题做合并批次。
- Mongo 不可用：降级为文件落盘；提供消费程序离线导入。
- 广播无序：功能上允许“最终一致”或在客户端缓冲重排，二选一。

## 里程碑（后端最小闭环）
- M0：Express + Socket.IO + 健康检查；/realtime 基础订阅/发布；日志。
- M1：/api/telemetry|perf 批量接收；文件或 Mongo 存储；基本索引。
- M2：可靠性增强：ack/重发、seq、有序、限流；Redis Adapter。
- M3：可视化（可选）：简单仪表盘（事件量/失败率/队列长度）。
