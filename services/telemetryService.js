import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { TelemetryEvent } from '../models/index.js';

/**
 * 遥测服务类
 */
class TelemetryService {
  constructor() {
    // 使用MongoDB存储，移除内存存储
    this.eventBuffer = [];
    this.batchProcessor = null;
    this.initBatchProcessor();
  }

  /**
   * 初始化批处理器
   */
  initBatchProcessor() {
    // 每5秒批量处理一次事件
    this.batchProcessor = setInterval(() => {
      this.processBatch();
    }, 5000);
  }

  /**
   * 保存遥测事件
   */
  async saveEvents(events) {
    const startTime = Date.now();
    
    try {
      logger.telemetry('Events Received', { 
        count: events.length,
        types: this.getEventTypeCounts(events)
      });

      const processedEvents = [];
      const duplicateEvents = [];
      const errorEvents = [];

      for (const event of events) {
        try {
          // 检查是否为重复事件（幂等性）
          if (await this.isDuplicateEvent(event)) {
            duplicateEvents.push(event.id);
            logger.telemetry('Duplicate Event Detected', { eventId: event.id, type: event.type });
            continue;
          }

          // 添加处理时间戳
          const processedEvent = {
            ...event,
            processedAt: Date.now(),
            receivedAt: Date.now(),
            requestId: event.requestId || uuidv4()
          };

          // 存储事件
          await this.storeEvent(processedEvent);
          processedEvents.push(processedEvent);

        } catch (error) {
          logger.error(`处理事件失败 ${event.id}:`, error);
          errorEvents.push({
            eventId: event.id,
            error: error.message
          });
        }
      }

      const processingTime = Date.now() - startTime;
      
      logger.telemetry('Events Processed', {
        received: events.length,
        processed: processedEvents.length,
        duplicates: duplicateEvents.length,
        errors: errorEvents.length,
        processingTime: `${processingTime}ms`
      });

      return {
        received: events.length,
        processed: processedEvents.length,
        duplicates: duplicateEvents.length,
        errors: errorEvents
      };

    } catch (error) {
      logger.error('批量保存事件失败:', error);
      throw error;
    }
  }

  /**
   * 获取事件类型统计
   */
  getEventTypeCounts(events) {
    return events.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
      return counts;
    }, {});
  }

  /**
   * 检查重复事件
   */
  async isDuplicateEvent(event) {
    try {
      const existingEvent = await TelemetryEvent.findOne({ eventId: event.id });
      return !!existingEvent;
    } catch (error) {
      logger.error('检查重复事件失败', { eventId: event.id, error: error.message });
      return false;
    }
  }

  /**
   * 存储单个事件
   */
  async storeEvent(event) {
    try {
      // 创建遥测事件文档
      const telemetryEvent = new TelemetryEvent({
        eventId: event.id,
        userId: event.userId,
        type: event.type,
        data: event.props || event.data || {},
        metadata: {
          userAgent: event.userAgent,
          ip: event.ip,
          url: event.url,
          referrer: event.referrer,
          timestamp: event.timestamp,
          processedAt: event.processedAt,
          receivedAt: event.receivedAt,
          requestId: event.requestId
        }
      });
      
      // 保存到数据库
      await telemetryEvent.save();
      
      // 添加到缓冲区用于批处理
      this.eventBuffer.push(event);
      
      logger.telemetry('Event stored', { 
        eventId: event.id, 
        type: event.type, 
        userId: event.userId 
      });
      
    } catch (error) {
      logger.error('存储事件失败', { 
        eventId: event.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * 批量处理缓冲区中的事件
   */
  async processBatch() {
    if (this.eventBuffer.length === 0) return;

    const batch = [...this.eventBuffer];
    this.eventBuffer = [];

    try {
      console.log(`处理批次: ${batch.length} 个事件`);
      
      // 在这里可以：
      // 1. 写入OLAP数据库（如ClickHouse）
      // 2. 发送到时序数据库（如InfluxDB）
      // 3. 推送到消息队列
      // 4. 进行实时分析处理
      
      // 按事件类型分组处理
      const eventsByType = this.groupEventsByType(batch);
      
      for (const [type, events] of Object.entries(eventsByType)) {
        await this.processEventsByType(type, events);
      }
      
    } catch (error) {
      console.error('批处理失败:', error);
      // 将失败的事件重新加入缓冲区
      this.eventBuffer.unshift(...batch);
    }
  }

  /**
   * 按类型分组事件
   */
  groupEventsByType(events) {
    return events.reduce((groups, event) => {
      if (!groups[event.type]) {
        groups[event.type] = [];
      }
      groups[event.type].push(event);
      return groups;
    }, {});
  }

  /**
   * 按类型处理事件
   */
  async processEventsByType(type, events) {
    switch (type) {
      case 'page':
        await this.processPageEvents(events);
        break;
      case 'error':
        await this.processErrorEvents(events);
        break;
      case 'api':
        await this.processApiEvents(events);
        break;
      case 'perf':
        await this.processPerfEvents(events);
        break;
      case 'custom':
      case 'event':
        await this.processCustomEvents(events);
        break;
      default:
        console.warn(`未知事件类型: ${type}`);
    }
  }

  /**
   * 处理页面事件
   */
  async processPageEvents(events) {
    console.log(`处理 ${events.length} 个页面事件`);
    // 实现页面访问统计逻辑
  }

  /**
   * 处理错误事件
   */
  async processErrorEvents(events) {
    console.log(`处理 ${events.length} 个错误事件`);
    // 实现错误监控和告警逻辑
    
    // 检查是否有严重错误需要立即处理
    const criticalErrors = events.filter(event => 
      event.props?.severity === 'error'
    );
    
    if (criticalErrors.length > 0) {
      console.warn(`发现 ${criticalErrors.length} 个严重错误`);
      // 这里可以发送告警通知
    }
  }

  /**
   * 处理API事件
   */
  async processApiEvents(events) {
    console.log(`处理 ${events.length} 个API事件`);
    // 实现API性能分析逻辑
  }

  /**
   * 处理性能事件
   */
  async processPerfEvents(events) {
    console.log(`处理 ${events.length} 个性能事件`);
    // 实现性能指标分析逻辑
  }

  /**
   * 处理自定义事件
   */
  async processCustomEvents(events) {
    console.log(`处理 ${events.length} 个自定义事件`);
    // 实现自定义事件分析逻辑
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    try {
      const [totalEvents, eventsByType] = await Promise.all([
        TelemetryEvent.countDocuments(),
        TelemetryEvent.getEventStatsByType()
      ]);
      
      return {
        totalEvents,
        bufferSize: this.eventBuffer.length,
        eventsByType,
        lastProcessed: new Date().toISOString()
      };
    } catch (error) {
      logger.error('获取统计信息失败', { error: error.message });
      return {
        totalEvents: 0,
        bufferSize: this.eventBuffer.length,
        eventsByType: {},
        lastProcessed: new Date().toISOString()
      };
    }
  }

  /**
   * 清理过期数据
   */
  async cleanup(olderThanMs = 7 * 24 * 60 * 60 * 1000) { // 默认7天
    try {
      const cutoffDate = new Date(Date.now() - olderThanMs);
      
      const result = await TelemetryEvent.deleteMany({
        createdAt: { $lt: cutoffDate }
      });
      
      logger.telemetry('Events cleaned up', { 
        deletedCount: result.deletedCount,
        cutoffDate: cutoffDate.toISOString()
      });
      
      return result.deletedCount;
    } catch (error) {
      logger.error('清理过期数据失败', { error: error.message });
      return 0;
    }
  }

  /**
   * 销毁服务
   */
  destroy() {
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
    }
  }
}

export default TelemetryService;
