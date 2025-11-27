import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
  origin: 'http://localhost:4000',   // adres frontu (Next.js)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept'],
});

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  
  const config = new DocumentBuilder()
    .setTitle('Board War API')
    .setDescription('The Board War API description')
    .setVersion('1.0')
    .addTag('board-war')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
