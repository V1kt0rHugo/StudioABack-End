import { Module } from '@nestjs/common';
import { CustomerServiceService } from './customer-service.service';
import { CustomerServiceController } from './customer-service.controller';
import { PrismaService } from 'src/database/prisma.service';

@Module({
  controllers: [CustomerServiceController],
  providers: [CustomerServiceService, PrismaService],
})
export class CustomerServiceModule {}
