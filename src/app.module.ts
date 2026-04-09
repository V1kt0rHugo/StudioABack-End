import { Module } from '@nestjs/common';
import { ClientModule } from './client/client.module';
import { EmployeeModule } from './employee/employee.module';
import { PrismaService } from './database/prisma.service';
import { EmployeeService } from './employee/employee.service';

@Module({
  imports: [ClientModule, EmployeeModule],
  providers: [EmployeeService, PrismaService],
})
export class AppModule { }
