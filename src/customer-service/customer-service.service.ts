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
  constructor(private prisma: PrismaService) { }

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
    let totalEstimatedDuration = 0;
    const performedServicesData: {
      idService: string;
      idEmployee: string;
      priceCharged: number;
      commissionPercentage: number;
      commissionValue: number;
    }[] = [];

    const employee = await this.prisma.employee.findUnique({
      where: { id: createCustomerServiceDto.employeeId },
      include: { Skills: true, Schedules: true },
    });

    if (!employee) {
      throw new NotFoundException(
        `Funcionário ${createCustomerServiceDto.employeeId} não encontrado`,
      );
    }

    const appointmentDate = createCustomerServiceDto.Date
      ? new Date(createCustomerServiceDto.Date)
      : new Date();

    for (const item of createCustomerServiceDto.services) {
      const service = await this.prisma.services.findUnique({
        where: { id: item.serviceId },
      });
      if (!service) {
        throw new NotFoundException(`Serviço ${item.serviceId} não encontrado`);
      }

      // Validação de Especialidade (Skill)
      const hasSkill = employee.Skills.some(
        (skill) => skill.id === item.serviceId,
      );
      if (!hasSkill) {
        throw new BadRequestException(
          `O funcionário ${employee.name} não possui a competência para realizar o serviço ${service.name}.`,
        );
      }

      totalEstimatedDuration += service.estimatedDuration;
      const price = item.customPrice ?? service.price;
      calculatedTotalValue += price;

      performedServicesData.push({
        idService: item.serviceId,
        idEmployee: employee.id,
        priceCharged: price,
        commissionPercentage: employee.commissionPercentage,
        commissionValue: price * (employee.commissionPercentage / 100),
      });
    }

    const endTime = new Date(
      appointmentDate.getTime() + totalEstimatedDuration * 60000,
    );

    // Validação de Escala de Horário (Schedule)
    const dayOfWeek = appointmentDate.getDay();
    const startHours = appointmentDate.getHours().toString().padStart(2, '0');
    const startMinutes = appointmentDate.getMinutes().toString().padStart(2, '0');
    const endHours = endTime.getHours().toString().padStart(2, '0');
    const endMinutes = endTime.getMinutes().toString().padStart(2, '0');

    const startTimeStr = `${startHours}:${startMinutes}`;
    const endTimeStr = `${endHours}:${endMinutes}`;

    if (employee.Schedules && employee.Schedules.length > 0) {
      const hasSchedule = employee.Schedules.some(
        (sched) =>
          sched.dayOfWeek === dayOfWeek &&
          sched.startTime <= startTimeStr &&
          sched.endTime >= endTimeStr,
      );

      if (!hasSchedule) {
        throw new BadRequestException(
          `O funcionário ${employee.name} não atende em turnos ativos suficientes para cobrir o horário (${startTimeStr} às ${endTimeStr}).`,
        );
      }
    }

    // Validação de Conflito de Horário (Overlap de Agendamentos)
    const overlappingService = await this.prisma.performedServices.findFirst({
      where: {
        idEmployee: employee.id,
        CustomerService: {
          Status: {
            not: 'CANCELED',
          },
          Date: {
            lt: endTime,
          },
          EndTime: {
            gt: appointmentDate,
          },
        },
      },
      include: {
        CustomerService: true,
      },
    });

    if (overlappingService) {
      throw new BadRequestException(
        `O funcionário ${employee.name} já possui ocupação na agenda para o período solicitado.`,
      );
    }

    const customerService = await this.prisma.customerService.create({
      data: {
        idClient: createCustomerServiceDto.idClient,
        Date: appointmentDate,
        EndTime: endTime,
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

  async update(id: string, updateCustomerServiceDto: UpdateCustomerServiceDto) {
    const existing = await this.prisma.customerService.findUnique({
      where: { id },
      include: { ConsumedItems: true },
    });

    if (!existing) throw new NotFoundException('Atendimento não encontrado');

    const newStatus = updateCustomerServiceDto.Status;
    const oldStatus = existing.Status;

    return await this.prisma.$transaction(async (tx) => {
      // Baixa de Estoque Opcional (Se houveram produtos consumidos)
      if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED' && updateCustomerServiceDto.consumedItems) {
        for (const item of updateCustomerServiceDto.consumedItems) {
          const product = await tx.products.findUnique({ where: { id: item.productId } });
          if (!product) throw new BadRequestException(`Produto ${item.productId} não encontrado.`);
          if (product.stock < item.usedQuantity) {
            throw new BadRequestException(`Estoque insuficiente para o produto ${product.name}. Disponível: ${product.stock}`);
          }

          // Atualizar estoque e gravar item consumido
          await tx.products.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.usedQuantity } },
          });

          await tx.consumedItems.create({
            data: {
              idCustomerService: id,
              idProduct: item.productId,
              usedQuantity: item.usedQuantity,
            },
          });
        }
      }

      // FASE 3: Lançamento Automático de Receita no Fluxo de Caixa (Ocorre sempre que o Status for finalizado!)
      if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
        
        // Retornando à estratégia Faturamento Bruto
        // O dinheiro cobrado pelo Terminal do Caixa no salão pertence integralmente ao Salão (Receita Bruta).
        // Posteriormente o caixa executará saídas (EXPENSES) para quitar a Folha de Pagamento baseando-se no relatório do funcionário.
        await tx.cashFlowTransaction.create({
          data: {
             type: 'INCOME',
             description: `Faturamento - Atendimento #${id.split('-')[0].toUpperCase()}`,
             amount: existing.TotalValue,
             idCustomerService: id
          }
        });
      }

      // Estorno de Estoque e Caixa: Atendimento mudou de finalizado para cancelado
      if (newStatus === 'CANCELED' && oldStatus === 'COMPLETED') {
        // Estornar itens do estoque
        for (const consumed of existing.ConsumedItems) {
          await tx.products.update({
            where: { id: consumed.idProduct },
            data: { stock: { increment: consumed.usedQuantity } },
          });
        }
        
        // FASE 3: Estorno Financeiro - Remove faturamento fantasma
        await tx.cashFlowTransaction.deleteMany({
           where: { idCustomerService: id }
        });
      }

      const { consumedItems, ...restUpdate } = updateCustomerServiceDto;

      return await tx.customerService.update({
        where: { id },
        data: restUpdate as any,
      });
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
