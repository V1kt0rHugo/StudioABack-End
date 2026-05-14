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
  ForbiddenException,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientFilterDto } from './dto/client-filter.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('client')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  async create(@Body() createClientDto: CreateClientDto) {
    return this.clientService.create(createClientDto);
  }

  @Post('verify')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.clientService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.code,
    );
  }

  @Post('resend-verification')
  async resendVerification(@Body() body: { email: string }) {
    return this.clientService.resendVerificationCode(body.email);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.PROFESSIONAL)
  @Get()
  findAll(@Query() filterDto: ClientFilterDto) {
    return this.clientService.findAll(filterDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.PROFESSIONAL)
  @Get('reminders')
  getReminders() {
    return this.clientService.getReminders();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.MANAGER, Role.PROFESSIONAL)
  @Get('deleted')
  findAllDeleted() {
    return this.clientService.findAllDeleted();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    const requester = req.user;
    if (requester.role === 'CLIENT' && requester.id !== id) {
      throw new ForbiddenException('Você só pode visualizar seus próprios dados.');
    }
    return this.clientService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/history')
  getHistory(@Param('id') id: string, @Request() req) {
    const requester = req.user;
    if (requester.role === 'CLIENT' && requester.id !== id) {
      throw new ForbiddenException('Você só pode visualizar seu próprio histórico.');
    }
    return this.clientService.getClientHistory(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateClientDto: UpdateClientDto,
    @Request() req,
  ) {
    const requester = req.user;
    // Cliente só pode editar a si mesmo; gerente/funcionário pode editar qualquer um
    if (requester.role === 'CLIENT' && requester.id !== id) {
      throw new ForbiddenException('Você só pode editar seus próprios dados.');
    }
    return this.clientService.update(id, updateClientDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req) {
    const requester = req.user;
    // Cliente só pode deletar a si mesmo; gerente/funcionário pode deletar qualquer um
    if (requester.role === 'CLIENT' && requester.id !== id) {
      throw new ForbiddenException('Você só pode excluir sua própria conta.');
    }
    return this.clientService.remove(id);
  }
}
