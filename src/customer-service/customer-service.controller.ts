import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { CustomerServiceService } from './customer-service.service';
import { CreateCustomerServiceDto } from './dto/create-customer-service.dto';
import { UpdateCustomerServiceDto } from './dto/update-customer-service.dto';

@Controller('customer-service')
export class CustomerServiceController {
  constructor(
    private readonly customerServiceService: CustomerServiceService,
  ) {}

  @Post()
  create(@Body() createCustomerServiceDto: CreateCustomerServiceDto) {
    return this.customerServiceService.create(createCustomerServiceDto);
  }

  @Get()
  findAll() {
    return this.customerServiceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerServiceService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCustomerServiceDto: UpdateCustomerServiceDto,
  ) {
    return this.customerServiceService.update(id, updateCustomerServiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerServiceService.remove(id);
  }

  @Get(':id/commission')
  calculateCommission(@Param('id') id: string) {
    return this.customerServiceService.calculateCommission(id);
  }
}
