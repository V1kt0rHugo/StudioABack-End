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
import { CashFlowService } from './cash-flow.service';
import { CreateCashFlowDto } from './dto/create-cash-flow.dto';
import { UpdateCashFlowDto } from './dto/update-cash-flow.dto';
import { CashFlowFilterDto } from './dto/cash-flow-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.MANAGER)
@Controller('cash-flow')
export class CashFlowController {
  constructor(private readonly cashFlowService: CashFlowService) {}

  @Post()
  create(@Body() createCashFlowDto: CreateCashFlowDto) {
    return this.cashFlowService.create(createCashFlowDto);
  }

  @Get('balance')
  getBalance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cashFlowService.getBalance(startDate, endDate);
  }

  @Get('dashboard')
  getDashboardStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cashFlowService.getDashboardStats(startDate, endDate);
  }

  @Get('forecast')
  getForecast(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.cashFlowService.getForecast(startDate, endDate);
  }

  @Get()
  findAll(@Query() filterDto: CashFlowFilterDto) {
    return this.cashFlowService.findAll(filterDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cashFlowService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCashFlowDto: UpdateCashFlowDto,
  ) {
    return this.cashFlowService.update(id, updateCashFlowDto);
  }

  @Patch(':id/pay')
  pay(@Param('id') id: string) {
    return this.cashFlowService.pay(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cashFlowService.remove(id);
  }
}
