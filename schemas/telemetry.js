import Joi from 'joi';

/**
 * 遥测事件基础Schema
 */
const telemetryEventSchema = Joi.object({
  id: Joi.string().required().max(100).description('事件唯一ID'),
  type: Joi.string()
    .valid('page', 'custom', 'error', 'api', 'perf', 'event')
    .required()
    .description('事件类型'),
  name: Joi.string().required().max(200).description('事件名称'),
  ts: Joi.number().integer().positive().required().description('时间戳（毫秒）'),
  
  // 应用信息
  app: Joi.string().required().max(50).description('应用名称'),
  release: Joi.string().required().max(20).description('版本号'),
  sessionId: Joi.string().required().max(100).description('会话ID'),
  
  // 用户信息（可选）
  user: Joi.object({
    id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    email: Joi.string().email().optional(),
    name: Joi.string().max(100).optional(),
    role: Joi.string().max(50).optional(),
    attrs: Joi.object().optional()
  }).optional(),
  
  // 事件属性
  props: Joi.object().optional().description('事件属性')
});

/**
 * 遥测事件批量上报Schema
 */
export const telemetryBatchSchema = Joi.array()
  .items(telemetryEventSchema)
  .min(1)
  .max(200)
  .required()
  .description('遥测事件数组');

/**
 * 验证遥测事件数据
 */
export const validateTelemetryBatch = (data) => {
  const { error, value } = telemetryBatchSchema.validate(data, {
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

/**
 * 验证单个事件大小
 */
export const validateEventSize = (event, maxSizeKB = 10) => {
  const eventSize = JSON.stringify(event).length;
  const maxSizeBytes = maxSizeKB * 1024;
  
  if (eventSize > maxSizeBytes) {
    const error = new Error(`事件大小超出限制：${Math.ceil(eventSize / 1024)}KB > ${maxSizeKB}KB`);
    error.name = 'PayloadTooLarge';
    throw error;
  }
  
  return true;
};
