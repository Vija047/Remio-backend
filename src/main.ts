import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.setGlobalPrefix('api');

  const isProd = configService.get<string>('NODE_ENV') === 'production';
  const allowedOrigins = [
    configService.get<string>('FRONTEND_URL'),
    configService.get<string>('APP_URL'),
  ].filter((url): url is string => Boolean(url));

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

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server running on http://localhost:${port}/api`);
  console.log(`Swagger Docs on http://localhost:${port}/api/docs`);
}
bootstrap();
