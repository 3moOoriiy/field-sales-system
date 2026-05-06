import * as Joi from 'joi';

export const configValidation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),
  BCRYPT_ROUNDS: Joi.number().min(8).max(15).default(12),
  LOGIN_MAX_ATTEMPTS: Joi.number().default(5),
  LOGIN_LOCK_MINUTES: Joi.number().default(15),
  RATE_LIMIT_PER_MINUTE: Joi.number().default(100),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  UPLOAD_DIR: Joi.string().default('/app/uploads'),
  MAX_UPLOAD_MB: Joi.number().default(10),
});
