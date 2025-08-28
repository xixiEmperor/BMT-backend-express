import jwt from 'jsonwebtoken';
import { 
  generateAccessToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} from '../middleware/auth.js';
import { config } from '../config/config.js';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

/**
 * 认证服务类
 */
class AuthService {
  constructor() {
    // 在实际项目中，这些应该存储在数据库中
    this.refreshTokens = new Map(); // 存储有效的刷新令牌
    this.users = new Map(); // 用户信息存储
    this.sessions = new Map(); // 会话管理
    
    // 初始化一些测试用户
    this.initTestUsers();
  }

  /**
   * 初始化测试用户（仅用于开发测试）
   */
  initTestUsers() {
    const testUsers = [
      {
        id: 'user_001',
        email: 'admin@example.com',
        name: '管理员',
        role: 'admin',
        permissions: ['telemetry:read', 'telemetry:write', 'admin:all']
      },
      {
        id: 'user_002',
        email: 'user@example.com',
        name: '普通用户',
        role: 'user',
        permissions: ['telemetry:write']
      }
    ];

    testUsers.forEach(user => {
      this.users.set(user.id, user);
    });
  }

  /**
   * 验证用户凭据（示例实现）
   */
  async authenticateUser(username, password) {
    logger.auth('Login Attempt', { username });
    
    // 在实际项目中，这里应该验证用户名密码
    // 这里仅作为示例
    const user = Array.from(this.users.values()).find(u => 
      u.email === username
    );

    if (!user) {
      logger.auth('Login Failed - User Not Found', { username });
      throw new Error('用户不存在');
    }

    // 简单的密码验证（实际应该使用bcrypt等）
    if (password !== 'password123') {
      logger.auth('Login Failed - Invalid Password', { username, userId: user.id });
      throw new Error('密码错误');
    }

    logger.auth('Login Success', { username, userId: user.id, role: user.role });
    return user;
  }

  /**
   * 生成令牌对
   */
  async generateTokens(user, fingerprint = null) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ userId: user.id });

    // 存储刷新令牌
    const tokenRecord = {
      userId: user.id,
      fingerprint,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isActive: true
    };

    this.refreshTokens.set(refreshToken, tokenRecord);
    
    logger.auth('Tokens Generated', { 
      userId: user.id, 
      fingerprint: fingerprint ? 'provided' : 'none',
      tokenCount: this.refreshTokens.size
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1小时
      tokenType: 'Bearer'
    };
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken, fingerprint = null) {
    // 验证刷新令牌
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('刷新令牌无效');
    }

    // 检查刷新令牌是否存在且有效
    const tokenRecord = this.refreshTokens.get(refreshToken);
    if (!tokenRecord || !tokenRecord.isActive) {
      throw new Error('刷新令牌已失效');
    }

    // 验证设备指纹（如果提供）
    if (fingerprint && tokenRecord.fingerprint && 
        tokenRecord.fingerprint !== fingerprint) {
      throw new Error('设备验证失败');
    }

    // 获取用户信息
    const user = this.users.get(decoded.userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    // 更新令牌使用时间
    tokenRecord.lastUsed = Date.now();

    // 生成新的访问令牌
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = generateAccessToken(payload);

    return {
      accessToken,
      expiresIn: 3600,
      tokenType: 'Bearer'
    };
  }

  /**
   * 验证访问令牌
   */
  async verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = this.users.get(decoded.userId);
      
      if (!user) {
        throw new Error('用户不存在');
      }

      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: user.permissions
        },
        expiresAt: decoded.exp * 1000
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * 撤销刷新令牌
   */
  async revokeRefreshToken(refreshToken) {
    const tokenRecord = this.refreshTokens.get(refreshToken);
    if (tokenRecord) {
      tokenRecord.isActive = false;
      return true;
    }
    return false;
  }

  /**
   * 撤销用户的所有刷新令牌
   */
  async revokeAllUserTokens(userId) {
    let revokedCount = 0;
    
    for (const [token, record] of this.refreshTokens.entries()) {
      if (record.userId === userId && record.isActive) {
        record.isActive = false;
        revokedCount++;
      }
    }
    
    return revokedCount;
  }

  /**
   * 清理过期的刷新令牌
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天
    let cleanedCount = 0;

    for (const [token, record] of this.refreshTokens.entries()) {
      if (now - record.createdAt > maxAge || !record.isActive) {
        this.refreshTokens.delete(token);
        cleanedCount++;
      }
    }

    console.log(`清理了 ${cleanedCount} 个过期刷新令牌`);
    return cleanedCount;
  }

  /**
   * 获取用户会话信息
   */
  getUserSessions(userId) {
    const sessions = [];
    
    for (const [token, record] of this.refreshTokens.entries()) {
      if (record.userId === userId && record.isActive) {
        sessions.push({
          fingerprint: record.fingerprint,
          createdAt: record.createdAt,
          lastUsed: record.lastUsed
        });
      }
    }
    
    return sessions;
  }

  /**
   * 获取认证统计信息
   */
  getStats() {
    const activeTokens = Array.from(this.refreshTokens.values())
      .filter(record => record.isActive);
    
    return {
      totalUsers: this.users.size,
      activeTokens: activeTokens.length,
      totalSessions: this.refreshTokens.size
    };
  }
}

export default AuthService;
