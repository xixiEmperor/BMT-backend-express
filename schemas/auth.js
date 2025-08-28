import Joi from 'joi';

/**
 * 刷新令牌请求Schema
 */
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().description('刷新令牌'),
  fingerprint: Joi.string().optional().description('设备指纹')
});

/**
 * 验证刷新令牌请求
 */
export const validateRefreshTokenRequest = (data) => {
  const { error, value } = refreshTokenSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
  
  if (error) {
    const validationError = new Error('参数验证失败');
    validationError.name = 'ValidationError';
    validationError.details = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));
    throw validationError;
  }
  
  return value;
};
