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
  Request,
  BadRequestException,
} from '@nestjs/common';
import { CustomerServiceService } from './customer-service.service';
import { CreateCustomerServiceDto } from './dto/create-customer-service.dto';
import { UpdateCustomerServiceDto } from './dto/update-customer-service.dto';
import { CustomerServiceFilterDto } from './dto/customer-service-filter.dto';
import { CheckoutCustomerServiceDto } from './dto/checkout-customer-service.dto';
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
  @Get('meus-agendamentos')
  findMyAppointments(@Request() req: { user: { id: string; role: string } }) {
    if (req.user.role === 'CLIENT') {
      throw new BadRequestException(
        'Acesso permitido apenas para funcionários',
      );
    }
    return this.customerServiceService.findMyAppointments(req.user.id);
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
  @Post(':id/add-service')
  addService(
    @Param('id') id: string,
    @Body() body: { services: any[]; employeeId?: string },
  ) {
    return this.customerServiceService.addService(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/checkout')
  checkout(
    @Param('id') id: string,
    @Body() checkoutDto: CheckoutCustomerServiceDto,
  ) {
    return this.customerServiceService.checkout(id, checkoutDto);
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
