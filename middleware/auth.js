import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';

/**
 * JWT认证中间件
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      code: 'Unauthorized',
      message: '未提供访问令牌',
      requestId: req.headers['x-request-id']
    });
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      return res.status(401).json({
        code: 'Unauthorized',
        message: '访问令牌无效或已过期',
        requestId: req.headers['x-request-id']
      });
    }
    req.user = user;
    next();
  });
};

/**
 * Socket.IO认证中间件
 */
export const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('认证失败：未提供令牌'));
    }
    
    // 移除Bearer前缀
    const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    const decoded = jwt.verify(actualToken, config.jwt.secret);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('认证失败：令牌无效'));
  }
};

/**
 * 生成访问令牌
 */
export const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * 生成刷新令牌
 */
export const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

/**
 * 验证刷新令牌
 */
export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
};
