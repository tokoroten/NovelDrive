/**
 * 環境変数の管理と検証
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { app } from 'electron';

// 環境変数をロード
dotenv.config();

/**
 * 環境変数の型定義
 */
interface EnvironmentVariables {
  // OpenAI
  OPENAI_API_KEY: string;
  OPENAI_ORGANIZATION?: string;
  OPENAI_CHAT_MODEL: string;
  OPENAI_COMPLETION_MODEL: string;
  OPENAI_EMBEDDING_MODEL: string;
  OPENAI_RATE_LIMIT: number;

  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  DATABASE_PATH?: string;

  // Autonomous Mode
  AUTONOMOUS_MODE_ENABLED: boolean;
  AUTONOMOUS_MODE_QUALITY_THRESHOLD: number;
  AUTONOMOUS_MODE_CHECK_INTERVAL: number;

  // Local Embedding
  LOCAL_EMBEDDING_MODEL: string;

  // Development
  ENABLE_DEVTOOLS: boolean;
  ENABLE_HOT_RELOAD: boolean;

  // Testing
  TEST_MODE: boolean;
  MOCK_AI_RESPONSES: boolean;

  // Performance
  MAX_CONCURRENT_EMBEDDINGS: number;
  EMBEDDING_CACHE_SIZE: number;

  // Security
  ENABLE_CONTENT_SECURITY_POLICY: boolean;
  ALLOWED_ORIGINS: string[];

  // Feature Flags
  FEATURE_24HOUR_MODE: boolean;
  FEATURE_MULTI_AGENT_DISCUSSION: boolean;
  FEATURE_SERENDIPITY_SEARCH: boolean;
  FEATURE_WEB_CRAWLER: boolean;

  // Analytics
  ENABLE_ANALYTICS: boolean;
  ANALYTICS_ID?: string;

  // Error Reporting
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;

  // Updates
  AUTO_UPDATE_ENABLED: boolean;
  UPDATE_FEED_URL?: string;
}

/**
 * デフォルト値
 */
const defaults: EnvironmentVariables = {
  // OpenAI
  OPENAI_API_KEY: '',
  OPENAI_CHAT_MODEL: 'gpt-4-turbo-preview',
  OPENAI_COMPLETION_MODEL: 'gpt-3.5-turbo',
  OPENAI_EMBEDDING_MODEL: 'text-embedding-3-small',
  OPENAI_RATE_LIMIT: 60,

  // Application
  NODE_ENV: 'development',
  LOG_LEVEL: 'info',

  // Autonomous Mode
  AUTONOMOUS_MODE_ENABLED: false,
  AUTONOMOUS_MODE_QUALITY_THRESHOLD: 0.7,
  AUTONOMOUS_MODE_CHECK_INTERVAL: 3600000,

  // Local Embedding
  LOCAL_EMBEDDING_MODEL: 'Xenova/all-MiniLM-L6-v2',

  // Development
  ENABLE_DEVTOOLS: true,
  ENABLE_HOT_RELOAD: true,

  // Testing
  TEST_MODE: false,
  MOCK_AI_RESPONSES: false,

  // Performance
  MAX_CONCURRENT_EMBEDDINGS: 5,
  EMBEDDING_CACHE_SIZE: 1000,

  // Security
  ENABLE_CONTENT_SECURITY_POLICY: true,
  ALLOWED_ORIGINS: ['http://localhost:3000', 'http://localhost:3003'],

  // Feature Flags
  FEATURE_24HOUR_MODE: true,
  FEATURE_MULTI_AGENT_DISCUSSION: true,
  FEATURE_SERENDIPITY_SEARCH: true,
  FEATURE_WEB_CRAWLER: true,

  // Analytics
  ENABLE_ANALYTICS: false,

  // Updates
  AUTO_UPDATE_ENABLED: true,
};

/**
 * 環境変数を取得
 */
function getEnvVar<T>(key: string, defaultValue: T, parser?: (value: string) => T): T {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  
  if (parser) {
    try {
      return parser(value);
    } catch (error) {
      console.warn(`Failed to parse env var ${key}: ${error}`);
      return defaultValue;
    }
  }
  
  return value as unknown as T;
}

/**
 * ブール値のパーサー
 */
function parseBoolean(value: string): boolean {
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * 数値のパーサー
 */
function parseNumber(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error('Not a valid number');
  }
  return num;
}

/**
 * 配列のパーサー
 */
function parseArray(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * 環境変数の設定を取得
 */
export const env: EnvironmentVariables = {
  // OpenAI
  OPENAI_API_KEY: getEnvVar('OPENAI_API_KEY', defaults.OPENAI_API_KEY),
  OPENAI_ORGANIZATION: getEnvVar('OPENAI_ORGANIZATION', defaults.OPENAI_ORGANIZATION),
  OPENAI_CHAT_MODEL: getEnvVar('OPENAI_CHAT_MODEL', defaults.OPENAI_CHAT_MODEL),
  OPENAI_COMPLETION_MODEL: getEnvVar('OPENAI_COMPLETION_MODEL', defaults.OPENAI_COMPLETION_MODEL),
  OPENAI_EMBEDDING_MODEL: getEnvVar('OPENAI_EMBEDDING_MODEL', defaults.OPENAI_EMBEDDING_MODEL),
  OPENAI_RATE_LIMIT: getEnvVar('OPENAI_RATE_LIMIT', defaults.OPENAI_RATE_LIMIT, parseNumber),

  // Application
  NODE_ENV: getEnvVar('NODE_ENV', defaults.NODE_ENV) as any,
  LOG_LEVEL: getEnvVar('LOG_LEVEL', defaults.LOG_LEVEL) as any,
  DATABASE_PATH: getEnvVar('DATABASE_PATH', path.join(app.getPath('userData'), 'noveldrive.db')),

  // Autonomous Mode
  AUTONOMOUS_MODE_ENABLED: getEnvVar('AUTONOMOUS_MODE_ENABLED', defaults.AUTONOMOUS_MODE_ENABLED, parseBoolean),
  AUTONOMOUS_MODE_QUALITY_THRESHOLD: getEnvVar('AUTONOMOUS_MODE_QUALITY_THRESHOLD', defaults.AUTONOMOUS_MODE_QUALITY_THRESHOLD, parseNumber),
  AUTONOMOUS_MODE_CHECK_INTERVAL: getEnvVar('AUTONOMOUS_MODE_CHECK_INTERVAL', defaults.AUTONOMOUS_MODE_CHECK_INTERVAL, parseNumber),

  // Local Embedding
  LOCAL_EMBEDDING_MODEL: getEnvVar('LOCAL_EMBEDDING_MODEL', defaults.LOCAL_EMBEDDING_MODEL),

  // Development
  ENABLE_DEVTOOLS: getEnvVar('ENABLE_DEVTOOLS', defaults.ENABLE_DEVTOOLS, parseBoolean),
  ENABLE_HOT_RELOAD: getEnvVar('ENABLE_HOT_RELOAD', defaults.ENABLE_HOT_RELOAD, parseBoolean),

  // Testing
  TEST_MODE: getEnvVar('TEST_MODE', defaults.TEST_MODE, parseBoolean),
  MOCK_AI_RESPONSES: getEnvVar('MOCK_AI_RESPONSES', defaults.MOCK_AI_RESPONSES, parseBoolean),

  // Performance
  MAX_CONCURRENT_EMBEDDINGS: getEnvVar('MAX_CONCURRENT_EMBEDDINGS', defaults.MAX_CONCURRENT_EMBEDDINGS, parseNumber),
  EMBEDDING_CACHE_SIZE: getEnvVar('EMBEDDING_CACHE_SIZE', defaults.EMBEDDING_CACHE_SIZE, parseNumber),

  // Security
  ENABLE_CONTENT_SECURITY_POLICY: getEnvVar('ENABLE_CONTENT_SECURITY_POLICY', defaults.ENABLE_CONTENT_SECURITY_POLICY, parseBoolean),
  ALLOWED_ORIGINS: getEnvVar('ALLOWED_ORIGINS', defaults.ALLOWED_ORIGINS, parseArray),

  // Feature Flags
  FEATURE_24HOUR_MODE: getEnvVar('FEATURE_24HOUR_MODE', defaults.FEATURE_24HOUR_MODE, parseBoolean),
  FEATURE_MULTI_AGENT_DISCUSSION: getEnvVar('FEATURE_MULTI_AGENT_DISCUSSION', defaults.FEATURE_MULTI_AGENT_DISCUSSION, parseBoolean),
  FEATURE_SERENDIPITY_SEARCH: getEnvVar('FEATURE_SERENDIPITY_SEARCH', defaults.FEATURE_SERENDIPITY_SEARCH, parseBoolean),
  FEATURE_WEB_CRAWLER: getEnvVar('FEATURE_WEB_CRAWLER', defaults.FEATURE_WEB_CRAWLER, parseBoolean),

  // Analytics
  ENABLE_ANALYTICS: getEnvVar('ENABLE_ANALYTICS', defaults.ENABLE_ANALYTICS, parseBoolean),
  ANALYTICS_ID: getEnvVar('ANALYTICS_ID', defaults.ANALYTICS_ID),

  // Error Reporting
  SENTRY_DSN: getEnvVar('SENTRY_DSN', defaults.SENTRY_DSN),
  SENTRY_ENVIRONMENT: getEnvVar('SENTRY_ENVIRONMENT', defaults.SENTRY_ENVIRONMENT),

  // Updates
  AUTO_UPDATE_ENABLED: getEnvVar('AUTO_UPDATE_ENABLED', defaults.AUTO_UPDATE_ENABLED, parseBoolean),
  UPDATE_FEED_URL: getEnvVar('UPDATE_FEED_URL', defaults.UPDATE_FEED_URL),
};

/**
 * 必須環境変数の検証
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  // OpenAI APIキーは必須（テストモードでない場合）
  if (!env.TEST_MODE && !env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required');
  }

  // その他の検証
  if (env.AUTONOMOUS_MODE_QUALITY_THRESHOLD < 0 || env.AUTONOMOUS_MODE_QUALITY_THRESHOLD > 1) {
    errors.push('AUTONOMOUS_MODE_QUALITY_THRESHOLD must be between 0 and 1');
  }

  if (env.AUTONOMOUS_MODE_CHECK_INTERVAL < 60000) {
    errors.push('AUTONOMOUS_MODE_CHECK_INTERVAL must be at least 60000ms (1 minute)');
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * 環境設定の概要を取得（センシティブな情報を除外）
 */
export function getEnvironmentSummary(): Record<string, any> {
  return {
    NODE_ENV: env.NODE_ENV,
    LOG_LEVEL: env.LOG_LEVEL,
    FEATURES: {
      '24_HOUR_MODE': env.FEATURE_24HOUR_MODE,
      'MULTI_AGENT_DISCUSSION': env.FEATURE_MULTI_AGENT_DISCUSSION,
      'SERENDIPITY_SEARCH': env.FEATURE_SERENDIPITY_SEARCH,
      'WEB_CRAWLER': env.FEATURE_WEB_CRAWLER,
    },
    OPENAI_CONFIGURED: !!env.OPENAI_API_KEY,
    ANALYTICS_ENABLED: env.ENABLE_ANALYTICS,
    AUTO_UPDATE_ENABLED: env.AUTO_UPDATE_ENABLED,
  };
}