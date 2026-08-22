import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Prod = 'prod',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString({ message: 'DATABASE_URL environment variable is required' })
  @MinLength(1, { message: 'DATABASE_URL must not be empty' })
  DATABASE_URL: string;

  @IsString({ message: 'JWT_SECRET environment variable is required' })
  @MinLength(16, {
    message: 'JWT_SECRET must be at least 16 characters long for production security',
  })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '7d';

  @IsString({ message: 'OPENROUTER_API_KEY environment variable is required' })
  @MinLength(1, { message: 'OPENROUTER_API_KEY must not be empty' })
  OPENROUTER_API_KEY: string;

  @IsString()
  @IsOptional()
  OPENROUTER_BASE_URL: string = 'https://openrouter.ai/api/v1';

  @IsString()
  @IsOptional()
  OPENROUTER_MODEL: string = 'openai/gpt-4o-mini';

  @IsString({ message: 'STRIPE_SECRET_KEY environment variable is required' })
  @MinLength(1, { message: 'STRIPE_SECRET_KEY must not be empty' })
  STRIPE_SECRET_KEY: string;

  @IsString()
  @IsOptional()
  STRIPE_PUBLISHABLE_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  APP_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((err) => Object.values(err.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Environment Configuration Error: ${errorMessages}`);
  }

  if (
    validatedConfig.JWT_SECRET === 'dev-jwt-secret-change-me' &&
    validatedConfig.NODE_ENV === Environment.Production
  ) {
    throw new Error(
      'Environment Configuration Error: JWT_SECRET is set to dev placeholder in production mode. A secure random secret must be configured.',
    );
  }

  if (
    validatedConfig.NODE_ENV === Environment.Production &&
    !validatedConfig.DATABASE_URL.includes('sslmode=') &&
    !validatedConfig.DATABASE_URL.includes('localhost')
  ) {
    console.warn(
      '[WARNING] DATABASE_URL does not explicitly contain sslmode (e.g. ?sslmode=require). Ensure RDS SSL connection is enabled in production.',
    );
  }

  return validatedConfig;
}
