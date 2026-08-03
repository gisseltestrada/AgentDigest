import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { SourcesController } from './sources/sources.controller';
import { SourcesService } from './sources/sources.service';

@Module({
  imports: [PrismaModule],
  controllers: [AppController, HealthController, SourcesController],
  providers: [AppService, SourcesService],
})
export class AppModule {}
