import { Module } from '@nestjs/common';
import { CashFlowService } from './cash-flow.service';
import { CashFlowController } from './cash-flow.controller';
import { PrismaService } from 'src/database/prisma.service';

@Module({
  controllers: [CashFlowController],
  providers: [CashFlowService, PrismaService],
})
export class CashFlowModule {}
