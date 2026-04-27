import { Module } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeController } from './employee.controller';
import { PrismaService } from 'src/database/prisma.service';
import { CashFlowModule } from 'src/cash-flow/cash-flow.module';

@Module({
  imports: [CashFlowModule],
  controllers: [EmployeeController],
  providers: [EmployeeService, PrismaService],
  exports: [EmployeeService],
})
export class EmployeeModule {}
