import { configure as serverlessExpress } from '@codegenie/serverless-express';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Callback, Context, Handler } from 'aws-lambda';
import express from 'express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { NotificationsService } from './notifications/notifications.service';

let cachedServer: Handler;
let cachedApp: INestApplication;

async function bootstrapServer(): Promise<Handler> {
  const expressApp = express();

  // Handle API Gateway stage prefixes (e.g. /prod) cleanly
  expressApp.use((req, res, next) => {
    if (req.url.startsWith('/prod')) {
      req.url = req.url.replace(/^\/prod/, '') || '/';
    }
    next();
  });

  // Root landing endpoint
  expressApp.get('/', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Routine AI API (AWS Lambda)',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        docs: '/api/docs',
        health: '/api/health',
        tasks: '/api/tasks',
        auth: '/api/auth',
      },
    });
  });

  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter);
  const configService = app.get(ConfigService);

  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const allowedOrigins = [
    configService.get<string>('FRONTEND_URL'),
    configService.get<string>('APP_URL'),
  ].filter((url): url is string => Boolean(url));

  app.use(helmet());
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (!isProd) return callback(null, true);
      if (
        allowedOrigins.length > 0 &&
        allowedOrigins.some((allowed) => origin.startsWith(allowed))
      ) {
        return callback(null, true);
      }
      return callback(
        new Error(`CORS policy does not allow access from origin: ${origin}`),
        false,
      );
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RoutineAI API')
    .setDescription('AI-powered recurring-task and personal routine prediction API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
  cachedApp = app;

  return serverlessExpress({ app: expressApp });
}

export const handler: Handler = async (
  event: any,
  context: Context,
  callback: Callback,
) => {
  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }
  return cachedServer(event, context, callback);
};

export const dispatchHandler: Handler = async () => {
  if (!cachedServer) {
    cachedServer = await bootstrapServer();
  }
  const notificationsService = cachedApp.get(NotificationsService);
  const dispatchedCount = await notificationsService.dispatchPending();
  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'ok',
      dispatchedCount,
      timestamp: new Date().toISOString(),
    }),
  };
};

