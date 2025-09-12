import mongoose from 'mongoose';

const telemetryEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: ['page', 'error', 'api', 'perf', 'custom', 'event'],
      message: '事件类型必须是page、error、api、perf、custom或event之一'
    },
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(v) {
        return v && typeof v === 'object';
      },
      message: '事件数据必须是对象类型'
    }
  },
  timestamp: {
    type: Number,
    required: true,
    index: true
  },
  processedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  requestId: {
    type: String,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String,
    sdkVersion: String
  }
}, {
  timestamps: true
});

// 复合索引
telemetryEventSchema.index({ type: 1, timestamp: -1 });
telemetryEventSchema.index({ userId: 1, timestamp: -1 });
telemetryEventSchema.index({ createdAt: -1 });
telemetryEventSchema.index({ type: 1, createdAt: -1 });

// 静态方法：按类型查询事件
telemetryEventSchema.statics.findByType = function(type, limit = 100) {
  return this.find({ type })
    .sort({ timestamp: -1 })
    .limit(limit);
};

// 静态方法：按时间范围查询
telemetryEventSchema.statics.findByTimeRange = function(startTime, endTime, options = {}) {
  const query = {
    timestamp: {
      $gte: startTime,
      $lte: endTime
    }
  };
  
  if (options.type) {
    query.type = options.type;
  }
  
  if (options.userId) {
    query.userId = options.userId;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(options.limit || 1000);
};

// 静态方法：获取事件统计
telemetryEventSchema.statics.getEventStats = function(timeRange = 24 * 60 * 60 * 1000) {
  const startTime = Date.now() - timeRange;
  
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startTime }
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        latestTimestamp: { $max: '$timestamp' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

export default mongoose.model('TelemetryEvent', telemetryEventSchema);