import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { CustomerServiceService } from './customer-service.service';
import { CreateCustomerServiceDto } from './dto/create-customer-service.dto';
import { UpdateCustomerServiceDto } from './dto/update-customer-service.dto';
import { CustomerServiceFilterDto } from './dto/customer-service-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customer-service')
export class CustomerServiceController {
  constructor(
    private readonly customerServiceService: CustomerServiceService,
  ) {}

  @Post()
  create(@Body() createCustomerServiceDto: CreateCustomerServiceDto) {
    return this.customerServiceService.create(createCustomerServiceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Query() filterDto: CustomerServiceFilterDto) {
    return this.customerServiceService.findAll(filterDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerServiceService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCustomerServiceDto: UpdateCustomerServiceDto,
  ) {
    return this.customerServiceService.update(id, updateCustomerServiceDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerServiceService.remove(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/commission')
  calculateCommission(@Param('id') id: string) {
    return this.customerServiceService.calculateCommission(id);
  }
}
