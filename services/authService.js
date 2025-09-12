import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} from '../middleware/auth.js';
import { config } from '../config/config.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { User, RefreshToken } from '../models/index.js';

/**
 * 认证服务类
 */
class AuthService {
  constructor() {
    // 使用MongoDB存储，不再需要内存存储
    // 初始化一些测试用户
    this.initTestUsers();
  }

  /**
   * 初始化测试用户（仅用于开发测试）
   */
  async initTestUsers() {
    try {
      // 检查是否已存在测试用户
      const existingAdmin = await User.findByEmail('admin@example.com');
      if (existingAdmin) {
        return; // 已存在，跳过初始化
      }

      const testUsers = [
        {
          email: 'admin@example.com',
          passwordHash: 'password123', // 将在保存时自动加密
          name: '管理员',
          role: 'admin',
          permissions: ['telemetry:read', 'telemetry:write', 'admin:all']
        },
        {
          email: 'user@example.com',
          passwordHash: 'password123', // 将在保存时自动加密
          name: '普通用户',
          role: 'user',
          permissions: ['telemetry:write']
        }
      ];

      await User.insertMany(testUsers);
      logger.auth('Test users initialized', { count: testUsers.length });
    } catch (error) {
      logger.error('Failed to initialize test users', { error: error.message });
    }
  }

  /**
   * 验证用户凭据
   */
  async authenticateUser(username, password) {
    try {
      logger.auth('Login Attempt', { username });
      
      // 从数据库查找用户
      const user = await User.findByEmail(username);
      if (!user) {
        logger.auth('Login Failed - User Not Found', { username });
        throw new Error('用户不存在');
      }

      // 检查用户是否激活
      if (!user.isActive) {
        logger.auth('Login Failed - User Inactive', { username, userId: user._id });
        throw new Error('用户账户已被禁用');
      }

      // 验证密码
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        logger.auth('Login Failed - Invalid Password', { username, userId: user._id });
        throw new Error('密码错误');
      }

      // 更新最后登录时间
      user.lastLoginAt = new Date();
      await user.save();

      logger.auth('Login Success', { username, userId: user._id, role: user.role });
      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions
      };
    } catch (error) {
      logger.error('Authentication error', { username, error: error.message });
      throw error;
    }
  }

  /**
   * 生成令牌对
   */
  async generateTokens(user, fingerprint = null, metadata = {}) {
    try {
      const payload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      };

      const accessToken = generateAccessToken(payload);
      const refreshTokenValue = generateRefreshToken({ userId: user.id });

      // 计算过期时间（7天）
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      // 存储刷新令牌到数据库
      const refreshToken = new RefreshToken({
        userId: user.id,
        token: refreshTokenValue,
        fingerprint,
        expiresAt,
        metadata: {
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
          deviceInfo: metadata.deviceInfo
        }
      });

      await refreshToken.save();
      
      logger.auth('Tokens Generated', { 
        userId: user.id, 
        fingerprint: fingerprint ? 'provided' : 'none',
        tokenId: refreshToken._id
      });

      return {
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: 3600, // 1小时
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.error('Token generation failed', { userId: user.id, error: error.message });
      throw new Error('令牌生成失败');
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshTokenValue, fingerprint = null) {
    try {
      // 验证刷新令牌格式
      const decoded = verifyRefreshToken(refreshTokenValue);
      if (!decoded) {
        throw new Error('刷新令牌无效');
      }

      // 从数据库查找有效的刷新令牌
      const tokenRecord = await RefreshToken.findValidToken(refreshTokenValue);
      if (!tokenRecord) {
        throw new Error('刷新令牌已失效或不存在');
      }

      // 验证设备指纹（如果提供）
      if (fingerprint && tokenRecord.fingerprint && 
          tokenRecord.fingerprint !== fingerprint) {
        logger.auth('Refresh Failed - Fingerprint Mismatch', { 
          userId: tokenRecord.userId,
          expected: tokenRecord.fingerprint,
          provided: fingerprint
        });
        throw new Error('设备验证失败');
      }

      // 获取用户信息
      const user = await User.findById(tokenRecord.userId);
      if (!user || !user.isActive) {
        throw new Error('用户不存在或已被禁用');
      }

      // 更新令牌使用时间
      tokenRecord.lastUsed = new Date();
      await tokenRecord.save();

      // 生成新的访问令牌
      const payload = {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        permissions: user.permissions
      };

      const accessToken = generateAccessToken(payload);

      logger.auth('Token Refreshed', { 
        userId: user._id,
        tokenId: tokenRecord._id
      });

      return {
        accessToken,
        expiresIn: 3600,
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.error('Token refresh failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // 从数据库查询用户信息
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('用户不存在或已被禁用');
      }

      return {
        valid: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions
        },
        expiresAt: decoded.exp * 1000
      };
    } catch (error) {
      logger.auth('Token verification failed', { error: error.message });
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * 撤销刷新令牌
   */
  async revokeRefreshToken(refreshTokenValue) {
    try {
      const tokenRecord = await RefreshToken.findOne({ 
        token: refreshTokenValue, 
        isActive: true 
      });
      
      if (tokenRecord) {
        await tokenRecord.revoke();
        logger.auth('Token revoked', { tokenId: tokenRecord._id, userId: tokenRecord.userId });
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Token revocation failed', { error: error.message });
      return false;
    }
  }

  /**
   * 撤销用户的所有刷新令牌
   */
  async revokeAllUserTokens(userId) {
    try {
      const result = await RefreshToken.updateMany(
        { userId, isActive: true },
        { $set: { isActive: false } }
      );
      
      logger.auth('All user tokens revoked', { 
        userId, 
        revokedCount: result.modifiedCount 
      });
      
      return result.modifiedCount;
    } catch (error) {
      logger.error('Failed to revoke all user tokens', { 
        userId, 
        error: error.message 
      });
      return 0;
    }
  }

  /**
   * 清理过期的刷新令牌
   */
  async cleanupExpiredTokens() {
    try {
      // MongoDB TTL索引会自动删除过期文档，这里主要清理非活跃令牌
      const result = await RefreshToken.deleteMany({
        $or: [
          { isActive: false },
          { expiresAt: { $lt: new Date() } }
        ]
      });

      logger.auth('Expired tokens cleaned up', { 
        deletedCount: result.deletedCount 
      });
      
      return result.deletedCount;
    } catch (error) {
      logger.error('Token cleanup failed', { error: error.message });
      return 0;
    }
  }

  /**
   * 获取用户会话信息
   */
  async getUserSessions(userId) {
    try {
      const sessions = await RefreshToken.find({
        userId,
        isActive: true
      }).select('fingerprint createdAt lastUsed metadata');
      
      return sessions.map(session => ({
        id: session._id,
        fingerprint: session.fingerprint,
        createdAt: session.createdAt,
        lastUsed: session.lastUsed,
        metadata: session.metadata
      }));
    } catch (error) {
      logger.error('Failed to get user sessions', { userId, error: error.message });
      return [];
    }
  }

  /**
   * 获取认证统计信息
   */
  async getStats() {
    try {
      const [totalUsers, activeTokens, totalSessions] = await Promise.all([
        User.countDocuments({ isActive: true }),
        RefreshToken.countDocuments({ isActive: true }),
        RefreshToken.countDocuments()
      ]);
      
      return {
        totalUsers,
        activeTokens,
        totalSessions
      };
    } catch (error) {
      logger.error('Failed to get auth stats', { error: error.message });
      return {
        totalUsers: 0,
        activeTokens: 0,
        totalSessions: 0
      };
    }
  }
}

export default AuthService;
