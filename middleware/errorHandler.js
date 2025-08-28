/**
 * 全局错误处理中间件
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // 默认错误响应
  let statusCode = 500;
  let errorResponse = {
    code: 'Internal',
    message: '服务器内部错误',
    requestId: req.headers['x-request-id']
  };

  // 根据错误类型设置响应
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorResponse.code = 'InvalidArgument';
    errorResponse.message = '参数验证失败';
    errorResponse.details = err.details;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorResponse.code = 'Unauthorized';
    errorResponse.message = '令牌验证失败';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorResponse.code = 'Unauthorized';
    errorResponse.message = '令牌已过期';
  } else if (err.status === 413) {
    statusCode = 413;
    errorResponse.code = 'PayloadTooLarge';
    errorResponse.message = '请求体过大';
  } else if (err.message) {
    errorResponse.message = err.message;
  }

  // 生产环境下不暴露错误堆栈
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404处理中间件
 */
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    code: 'NotFound',
    message: '请求的资源不存在',
    requestId: req.headers['x-request-id'],
    path: req.path
  });
};

/**
 * 请求ID中间件
 */
export const requestIdMiddleware = (req, res, next) => {
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = generateRequestId();
  }
  res.setHeader('X-Request-Id', req.headers['x-request-id']);
  next();
};

/**
 * 生成请求ID
 */
function generateRequestId() {
  return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
