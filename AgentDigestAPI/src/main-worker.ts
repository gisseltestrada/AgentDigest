import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

// Currently a shell... to be a job/processor in the future?
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  Logger.log('Worker started', 'Bootstrap');
  await app.init();
}
bootstrap();
