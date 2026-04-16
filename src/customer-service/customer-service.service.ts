import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateCustomerServiceDto } from './dto/create-customer-service.dto';
import { UpdateCustomerServiceDto } from './dto/update-customer-service.dto';
import { PrismaService } from 'src/database/prisma.service';

export interface CommissionResult {
  employeeId: string;
  employeeName: string;
  totalCommission: number;
  services: {
    serviceId: string;
    serviceName: string;
    priceCharged: number;
    commissionPercentage: number;
    commissionValue: number;
  }[];
}

export interface CommissionByServiceResult {
  employeeId: string;
  employeeName: string;
  totalCommission: number;
}

@Injectable()
export class CustomerServiceService {
  constructor(private prisma: PrismaService) {}

  async create(createCustomerServiceDto: CreateCustomerServiceDto) {
    const client = await this.prisma.client.findUnique({
      where: {
        id: createCustomerServiceDto.idClient,
      },
    });
    if (!client) {
      throw new NotFoundException('Cliente não encontrado');
    }

    let calculatedTotalValue = 0;
    const performedServicesData: {
      idService: string;
      idEmployee: string;
      priceCharged: number;
      commissionPercentage: number;
      commissionValue: number;
    }[] = [];

    for (const item of createCustomerServiceDto.services) {
      const service = await this.prisma.services.findUnique({
        where: { id: item.serviceId },
      });
      if (!service) {
        throw new NotFoundException(`Serviço ${item.serviceId} não encontrado`);
      }

      const employee = await this.prisma.employee.findUnique({
        where: { id: item.employeeId },
        include: { Skills: true, Schedules: true },
      });
      if (!employee) {
        throw new NotFoundException(
          `Funcionário ${item.employeeId} não encontrado`,
        );
      }

      // Validação de Especialidade (Skill)
      const hasSkill = employee.Skills.some((skill) => skill.id === item.serviceId);
      if (!hasSkill) {
        throw new BadRequestException(
          `O funcionário ${employee.name} não possui a competência para realizar o serviço ${service.name}.`,
        );
      }

      // Validação de Escala de Horário (Schedule)
      const appointmentDate = createCustomerServiceDto.Date
        ? new Date(createCustomerServiceDto.Date)
        : new Date();
      const dayOfWeek = appointmentDate.getDay();
      const hours = appointmentDate.getHours().toString().padStart(2, '0');
      const minutes = appointmentDate.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      if (employee.Schedules && employee.Schedules.length > 0) {
        const hasSchedule = employee.Schedules.some(
          (sched) =>
            sched.dayOfWeek === dayOfWeek &&
            sched.startTime <= timeStr &&
            sched.endTime >= timeStr,
        );

        if (!hasSchedule) {
          throw new BadRequestException(
            `O funcionário ${employee.name} não atende em turnos ativos neste horário (${timeStr}).`,
          );
        }
      }

      const price = item.customPrice ?? service.price;
      calculatedTotalValue += price;

      performedServicesData.push({
        idService: item.serviceId,
        idEmployee: item.employeeId,
        priceCharged: price,
        commissionPercentage: employee.commissionPercentage,
        commissionValue: price * (employee.commissionPercentage / 100),
      });
    }

    const customerService = await this.prisma.customerService.create({
      data: {
        idClient: createCustomerServiceDto.idClient,
        Date: createCustomerServiceDto.Date
          ? new Date(createCustomerServiceDto.Date)
          : new Date(),
        TotalValue: calculatedTotalValue,
        PerformedServices: {
          create: performedServicesData,
        },
      },
    });
    return customerService;
  }

  findAll() {
    return this.prisma.customerService.findMany();
  }

  findOne(id: string) {
    return this.prisma.customerService.findUnique({
      where: { id },
    });
  }

  update(id: string, updateCustomerServiceDto: UpdateCustomerServiceDto) {
    return this.prisma.customerService.update({
      where: { id },
      data: updateCustomerServiceDto,
    });
  }

  remove(id: string) {
    return this.prisma.customerService.delete({
      where: { id },
    });
  }

  async calculateCommission(
    customerServiceId: string,
  ): Promise<CommissionByServiceResult[]> {
    const performedServices = await this.prisma.performedServices.findMany({
      where: { idCustomerService: customerServiceId },
      include: {
        Service: true,
        Employee: true,
      },
    });

    const commissionMap = new Map<string, CommissionByServiceResult>();

    for (const ps of performedServices) {
      const commissionValue = ps.commissionValue;

      const existing = commissionMap.get(ps.idEmployee);
      if (existing) {
        existing.totalCommission += commissionValue;
      } else {
        commissionMap.set(ps.idEmployee, {
          employeeId: ps.idEmployee,
          employeeName: ps.Employee.name,
          totalCommission: commissionValue,
        });
      }
    }

    return Array.from(commissionMap.values());
  }
}
