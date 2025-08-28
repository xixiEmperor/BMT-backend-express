import express from 'express';
import AuthService from '../services/authService.js';
import { validateRefreshTokenRequest } from '../schemas/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const authService = new AuthService();

/**
 * 刷新访问令牌
 * POST /v1/auth/refresh
 */
router.post('/refresh', authRateLimiter, async (req, res, next) => {
  try {
    // 验证请求参数
    const { refreshToken, fingerprint } = validateRefreshTokenRequest(req.body);

    if (!refreshToken) {
      return res.status(400).json({
        code: 'InvalidArgument',
        message: '缺少刷新令牌',
        requestId: req.headers['x-request-id']
      });
    }

    // 刷新访问令牌
    const result = await authService.refreshAccessToken(refreshToken, fingerprint);

    res.json({
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      requestId: req.headers['x-request-id']
    });

  } catch (error) {
    if (error.message.includes('无效') || error.message.includes('失效') || error.message.includes('验证失败')) {
      return res.status(401).json({
        code: 'Unauthorized',
        message: error.message,
        requestId: req.headers['x-request-id']
      });
    }
    next(error);
  }
});

/**
 * 验证访问令牌
 * GET /v1/auth/verify
 */
router.get('/verify', authenticateToken, async (req, res, next) => {
  try {
    // 如果能到达这里，说明令牌验证已经通过
    const user = req.user;

    res.json({
      valid: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions
      },
      expiresAt: user.exp * 1000,
      requestId: req.headers['x-request-id']
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 用户登录（获取令牌）
 * POST /v1/auth/login
 */
router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const { username, password, fingerprint } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        code: 'InvalidArgument',
        message: '用户名和密码不能为空',
        requestId: req.headers['x-request-id']
      });
    }

    // 验证用户凭据
    const user = await authService.authenticateUser(username, password);

    // 生成令牌
    const tokens = await authService.generateTokens(user, fingerprint);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      requestId: req.headers['x-request-id']
    });

  } catch (error) {
    if (error.message.includes('用户不存在') || error.message.includes('密码错误')) {
      return res.status(401).json({
        code: 'Unauthorized',
        message: '用户名或密码错误',
        requestId: req.headers['x-request-id']
      });
    }
    next(error);
  }
});

/**
 * 用户登出（撤销令牌）
 * POST /v1/auth/logout
 */
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    res.json({
      success: true,
      message: '登出成功',
      requestId: req.headers['x-request-id']
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 撤销所有令牌
 * POST /v1/auth/revoke-all
 */
router.post('/revoke-all', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const revokedCount = await authService.revokeAllUserTokens(userId);

    res.json({
      success: true,
      message: `撤销了 ${revokedCount} 个令牌`,
      revokedCount,
      requestId: req.headers['x-request-id']
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 获取用户会话信息
 * GET /v1/auth/sessions
 */
router.get('/sessions', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const sessions = authService.getUserSessions(userId);

    res.json({
      success: true,
      sessions,
      requestId: req.headers['x-request-id']
    });

  } catch (error) {
    next(error);
  }
});

/**
 * 获取认证统计信息（管理员专用）
 * GET /v1/auth/stats
 */
router.get('/stats', authenticateToken, async (req, res, next) => {
  try {
    // 检查管理员权限
    if (!req.user.permissions?.includes('admin:all')) {
      return res.status(403).json({
        code: 'Forbidden',
        message: '权限不足',
        requestId: req.headers['x-request-id']
      });
    }

    const stats = authService.getStats();

    res.json({
      success: true,
      data: stats,
      timestamp: Date.now(),
      requestId: req.headers['x-request-id']
    });

  } catch (error) {
    next(error);
  }
});

export default router;
