import { Module } from '@nestjs/common';
import { ClientModule } from './client/client.module';
import { EmployeeModule } from './employee/employee.module';
import { PrismaService } from './database/prisma.service';
import { EmployeeService } from './employee/employee.service';
import { CustomerServiceModule } from './customer-service/customer-service.module';
import { ServicesModule } from './services/services.module';
import { ProductsModule } from './products/products.module';
import { CashFlowModule } from './cash-flow/cash-flow.module';

@Module({
  imports: [
    ClientModule,
    EmployeeModule,
    CustomerServiceModule,
    ServicesModule,
    ProductsModule,
    CashFlowModule,
  ],
  providers: [EmployeeService, PrismaService],
})
export class AppModule { }
