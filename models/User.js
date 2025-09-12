import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, '邮箱是必需的'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址']
  },
  passwordHash: {
    type: String,
    required: [true, '密码是必需的'],
    minlength: [6, '密码至少6位']
  },
  name: {
    type: String,
    required: [true, '姓名是必需的'],
    trim: true,
    maxlength: [50, '姓名不能超过50个字符']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'user'],
      message: '角色必须是admin或user'
    },
    default: 'user'
  },
  permissions: [{
    type: String,
    enum: ['telemetry:read', 'telemetry:write', 'admin:all']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.passwordHash;
      return ret;
    }
  }
});

// 创建索引
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 实例方法：验证密码
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// 静态方法：根据邮箱查找用户
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

export default mongoose.model('User', userSchema);