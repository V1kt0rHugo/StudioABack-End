import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PayCommissionsDto } from './dto/pay-commissions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) { }

  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeeService.create(createEmployeeDto);
  }

  @Get()
  findAll() {
    return this.employeeService.findAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER)
  @Post('pay-commissions')
  payCommissions(@Body() payCommissionsDto: PayCommissionsDto) {
    return this.employeeService.payCommissions(payCommissionsDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeeService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.employeeService.remove(id);
  }

  // Rota para calcular comissões de um funcionário específico
  // Exemplo de chamada: GET http://localhost:3000/employee/123/commissions?startDate=2026-04-01&endDate=2026-04-30
  @Get(':id/commissions')
  getCommissions(
    @Param('id') id: string, // Pega o ID da URL
    @Query('startDate') startDate?: string, // Opcional
    @Query('endDate') endDate?: string, // Opcional
    @Query('status') paymentStatus?: 'PENDING' | 'PAID' | 'ALL', // Filtro mágico
  ) {
    return this.employeeService.getCommissions(id, startDate, endDate, paymentStatus);
  }
}
