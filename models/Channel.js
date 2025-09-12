import mongoose from 'mongoose';

const channelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['public', 'private', 'system'],
    default: 'public',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  metadata: {
    maxSubscribers: {
      type: Number,
      default: 1000
    },
    requiresAuth: {
      type: Boolean,
      default: false
    },
    permissions: [{
      type: String,
      enum: ['read', 'write', 'admin']
    }]
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  subscriberCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// 索引
channelSchema.index({ type: 1, isActive: 1 });
channelSchema.index({ createdBy: 1 });

// 静态方法：查找活跃频道
channelSchema.statics.findActiveChannels = function(type = null) {
  const query = { isActive: true };
  if (type) {
    query.type = type;
  }
  return this.find(query).populate('createdBy', 'name email');
};

// 实例方法：增加订阅者数量
channelSchema.methods.incrementSubscribers = function() {
  this.subscriberCount += 1;
  return this.save();
};

// 实例方法：减少订阅者数量
channelSchema.methods.decrementSubscribers = function() {
  if (this.subscriberCount > 0) {
    this.subscriberCount -= 1;
  }
  return this.save();
};

export default mongoose.model('Channel', channelSchema);