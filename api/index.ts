import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TypeormExceptionFilter } from '../src/common/filters/typeorm-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { LoggingInterceptor } from '../src/common/interceptors';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

let app: NestExpressApplication;

async function createNestServer() {
  app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static files from public directory
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public/',
  });

  // Serve index.html for root path
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Security headers configuration for production
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          scriptSrc: ["'self'"],
          connectSrc: [
            "'self'",
            process.env.FRONTEND_URL || 'https://your-frontend-url.vercel.app',
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'same-origin' },
    }),
  );

  // Global pipes configuration
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: true,
    }),
  );

  // Enhanced CORS configuration for production
  app.enableCors({
    origin: [
      process.env.FRONTEND_URL || 'https://your-frontend-url.vercel.app',
      'http://localhost:3000', // for development
      'https://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // Global interceptors and filters
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter(), new TypeormExceptionFilter());

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('E-Commerce API')
    .setDescription('API Documentation for E-Commerce Backend')
    .setVersion('1.0')
    .setContact('Development Team', '', 'contact@yourcompany.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addServer('https://your-api.vercel.app', 'Production Server')
    .addServer('http://localhost:8000', 'Development Server')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'E-Commerce API Documentation',
    customfavIcon: '/favicon.ico',
  });

  await app.init();
  return app;
}

export default async function handler(req: any, res: any) {
  if (!app) {
    await createNestServer();
  }

  return app.getHttpAdapter().getInstance()(req, res);
}
