import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  connectionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  socketId: {
    type: String,
    required: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    fingerprint: String,
    deviceInfo: String
  },
  connectedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  disconnectedAt: {
    type: Date,
    default: null
  },
  disconnectReason: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// 复合索引
connectionSchema.index({ userId: 1, isActive: 1 });
connectionSchema.index({ lastActivity: 1, isActive: 1 });

// 静态方法：查找活跃连接
connectionSchema.statics.findActiveConnections = function(userId = null) {
  const query = { isActive: true };
  if (userId) {
    query.userId = userId;
  }
  return this.find(query).populate('userId', 'name email role');
};

// 静态方法：清理过期连接
connectionSchema.statics.cleanupStaleConnections = function(timeoutMs = 5 * 60 * 1000) {
  const cutoffTime = new Date(Date.now() - timeoutMs);
  return this.updateMany(
    {
      isActive: true,
      lastActivity: { $lt: cutoffTime }
    },
    {
      $set: {
        isActive: false,
        disconnectedAt: new Date(),
        disconnectReason: 'timeout'
      }
    }
  );
};

// 实例方法：更新活跃时间
connectionSchema.methods.updateActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// 实例方法：断开连接
connectionSchema.methods.disconnect = function(reason = 'manual') {
  this.isActive = false;
  this.disconnectedAt = new Date();
  this.disconnectReason = reason;
  return this.save();
};

export default mongoose.model('Connection', connectionSchema);