// Aggressive early logging — these run BEFORE Nest imports load,
// so we can see exactly which step fails on cold-start in production.
const stage = (label: string) => process.stderr.write(`[boot] ${label}\n`);
stage('main.ts entered');

process.on('uncaughtException', (err) => {
  process.stderr.write(`[boot] uncaughtException: ${err.stack ?? err}\n`);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[boot] unhandledRejection: ${(reason as Error)?.stack ?? reason}\n`);
  process.exit(1);
});

import { NestFactory } from '@nestjs/core';
stage('@nestjs/core loaded');
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
stage('http middleware loaded');
import { AppModule } from './app.module';
stage('AppModule loaded');
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Make BigInt JSON-serialisable (used by agent_locations.id and audit_logs.id)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  stage('bootstrap() entered');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  stage('NestFactory.create resolved');
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useWebSocketAdapter(new IoAdapter(app));

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cookieParser());

  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerCfg = new DocumentBuilder()
    .setTitle('Field Sales API')
    .setDescription('Backend API for the Field Sales System')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup('api/docs', app, swaggerDoc, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = Number(process.env.PORT ?? 3000);
  stage(`about to listen on :${port}`);
  await app.listen(port, '0.0.0.0');
  stage('app.listen resolved');
  logger.log(`Backend listening on http://0.0.0.0:${port}`);
  logger.log(`Swagger docs at http://0.0.0.0:${port}/api/docs`);
}

bootstrap().catch((err) => {
  process.stderr.write(`[boot] FATAL bootstrap error: ${(err as Error)?.stack ?? err}\n`);
  process.exit(1);
});
