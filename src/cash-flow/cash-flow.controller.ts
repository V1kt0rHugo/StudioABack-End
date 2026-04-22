import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CashFlowService } from './cash-flow.service';
import { CreateCashFlowDto } from './dto/create-cash-flow.dto';
import { UpdateCashFlowDto } from './dto/update-cash-flow.dto';

@Controller('cash-flow')
export class CashFlowController {
  constructor(private readonly cashFlowService: CashFlowService) {}

  @Post()
  create(@Body() createCashFlowDto: CreateCashFlowDto) {
    return this.cashFlowService.create(createCashFlowDto);
  }

  @Get('balance')
  getBalance() {
    return this.cashFlowService.getBalance();
  }

  @Get()
  findAll() {
    return this.cashFlowService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cashFlowService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCashFlowDto: UpdateCashFlowDto) {
    return this.cashFlowService.update(id, updateCashFlowDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cashFlowService.remove(id);
  }
}
