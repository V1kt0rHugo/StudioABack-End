import { Injectable, NotFoundException } from '@nestjs/common';
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
      });
      if (!employee) {
        throw new NotFoundException(
          `Funcionário ${item.employeeId} não encontrado`,
        );
      }

      const price = item.customPrice ?? service.price;
      calculatedTotalValue += price;

      performedServicesData.push({
        idService: item.serviceId,
        idEmployee: item.employeeId,
        priceCharged: price,
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
      const commissionValue =
        ps.priceCharged * (ps.Service.commissionPercentage / 100);

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
