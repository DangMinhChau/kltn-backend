import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // Database Configuration
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  // JWT Configuration
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
  PASSWORD_RESET_TOKEN_EXPIRES_IN: Joi.string().default('1h'),

  // Security Configuration
  BCRYPT_SALT_ROUNDS: Joi.number().min(10).max(15).default(12),
  MAX_LOGIN_ATTEMPTS: Joi.number().min(3).max(10).default(5),
  LOCKOUT_DURATION: Joi.number().min(60000).default(900000), // 15 minutes minimum
  // Rate Limiting Configuration
  THROTTLE_TTL: Joi.number().min(1).default(60), // Time window in seconds
  THROTTLE_LIMIT: Joi.number().min(1).default(100), // Maximum requests per TTL

  // OAuth2 Gmail Configuration (required for mail service)
  EMAIL_FROM: Joi.string().email().required(),
  GMAIL_CLIENT_ID: Joi.string().required(),
  GMAIL_CLIENT_SECRET: Joi.string().required(),
  GMAIL_REFRESH_TOKEN: Joi.string().required(),
  GMAIL_ACCESS_TOKEN: Joi.string().optional(), // Optional as it can be generated from refresh token

  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(), // Payment Configuration
  VNPAY_URL: Joi.string().uri(),
  VNPAY_TMN_CODE: Joi.string(),
  VNPAY_HASH_SECRET: Joi.string(),
  VNPAY_RETURN_URL: Joi.string().uri(),
  VNPAY_IPN_URL: Joi.string().uri(), // Webhook URL for VNPay IPN

  // Webhook Configuration
  WEBHOOK_ALERTS_ENABLED: Joi.boolean().default(false),
  WEBHOOK_RETENTION_DAYS: Joi.number().min(1).max(365).default(30),
  // Email Alert Configuration
  WEBHOOK_ALERTS_EMAIL_ENABLED: Joi.boolean().default(false),
  WEBHOOK_ALERTS_EMAIL_RECIPIENTS: Joi.string().when(
    'WEBHOOK_ALERTS_EMAIL_ENABLED',
    {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    },
  ),

  // Webhook Monitoring Thresholds
  WEBHOOK_ERROR_THRESHOLD: Joi.number().min(1).max(100).default(10),
  WEBHOOK_SLOW_THRESHOLD_MS: Joi.number().min(100).default(5000),
  WEBHOOK_CONSECUTIVE_FAILURES_THRESHOLD: Joi.number().min(1).default(5),
});
