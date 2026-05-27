import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get('summary')
  getSummary(@Request() req: any, @Query('date') dateString?: string) {
    const { sub: employeeId, role } = req.user;
    return this.dashboardService.getSummary(employeeId, role, dateString);
  }

  @UseGuards(JwtAuthGuard)
  @Get('meus-agendamentos')
  getMyAppointments(@Request() req: any) {
    const { sub: employeeId } = req.user;
    return this.dashboardService.findMyAppointments(employeeId);
  }
}
