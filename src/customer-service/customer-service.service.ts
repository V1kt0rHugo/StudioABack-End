import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CreateCustomerServiceDto } from './dto/create-customer-service.dto';
import { UpdateCustomerServiceDto } from './dto/update-customer-service.dto';
import { CustomerServiceFilterDto } from './dto/customer-service-filter.dto';
import { CheckoutCustomerServiceDto } from './dto/checkout-customer-service.dto';
import { PrismaService } from 'src/database/prisma.service';
import { Prisma } from '@prisma/client';
import { MailService } from 'src/mail/mail.service';
import { NotificationsService } from 'src/notifications/notifications.service';
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
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

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
      include: { Schedules: true, ServiceConfigs: true },
    });

    if (!employee) {
      throw new NotFoundException(
        `Funcionário ${createCustomerServiceDto.employeeId} não encontrado`,
      );
    }

    const appointmentDate = createCustomerServiceDto.Date
      ? new Date(createCustomerServiceDto.Date)
      : new Date();

    const serviceNamesList: string[] = [];
    for (const item of createCustomerServiceDto.services) {
      const service = await this.prisma.services.findUnique({
        where: { id: item.serviceId },
      });
      if (!service) {
        throw new NotFoundException(`Serviço ${item.serviceId} não encontrado`);
      }
      serviceNamesList.push(service.name);

      // Validação de Especialidade (Skill)
      const hasSkill = employee.ServiceConfigs.some(
        (config) => config.idService === item.serviceId,
      );
      if (!hasSkill) {
        throw new BadRequestException(
          `O funcionário ${employee.name} não possui a competência para realizar o serviço ${service.name}.`,
        );
      }

      // Busca a configuração personalizada do funcionário para este serviço
      const customConfig = employee.ServiceConfigs.find(
        (config) => config.idService === item.serviceId,
      );

      const duration =
        item.customDuration ?? customConfig?.customDuration ?? service.estimatedDuration;
      totalEstimatedDuration += duration;

      const price =
        item.customPrice ?? customConfig?.customPrice ?? service.price;
      calculatedTotalValue += price;

      const commissionPct =
        customConfig?.customCommission ?? employee.commissionPercentage;

      performedServicesData.push({
        idService: item.serviceId,
        idEmployee: employee.id,
        priceCharged: price,
        commissionPercentage: commissionPct,
        commissionValue: price * (commissionPct / 100),
      });
    }

    const endTime = new Date(
      appointmentDate.getTime() + totalEstimatedDuration * 60000,
    );

    // Validação de Escala de Horário (Schedule)
    const dayOfWeek = appointmentDate.getDay();
    const startHours = appointmentDate.getHours().toString().padStart(2, '0');
    const startMinutes = appointmentDate
      .getMinutes()
      .toString()
      .padStart(2, '0');
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
          'Você não marcou disponibilidade neste horário. Marque disponibilidade na sua escala ou tente em outro momento.',
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
      const conflictStart = overlappingService.CustomerService.Date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      const conflictEnd = overlappingService.CustomerService.EndTime.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      throw new BadRequestException(
        `Um cliente já reservou um serviço que começa às ${conflictStart} e termina às ${conflictEnd}.`,
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
        clientFeedback: createCustomerServiceDto.clientFeedback,
      },
    });

    // Enviar notificações de forma assíncrona (sem travar a resposta HTTP)
    const serviceNames = serviceNamesList.join(', ');
    const formattedDate = appointmentDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    this.mailService.sendNotification(
      client.email,
      'Agendamento Confirmado - Studio A',
      'Seu agendamento foi confirmado!',
      `Olá, ${client.name}! Seu agendamento no Studio A foi realizado com sucesso. Esperamos você no horário agendado!`,
      [
        { label: 'Serviço(s)', value: serviceNames },
        { label: 'Profissional', value: employee.name },
        { label: 'Data e Hora', value: formattedDate },
        { label: 'Valor Estimado', value: `R$ ${calculatedTotalValue.toFixed(2)}` },
      ]
    ).catch(err => console.error('Erro ao enviar e-mail de agendamento para o cliente:', err));

    this.mailService.sendNotification(
      employee.email,
      'Novo Atendimento na sua Agenda - Studio A',
      'Você tem um novo atendimento agendado!',
      `Olá, ${employee.name}! Um novo atendimento com você foi registrado no sistema.`,
      [
        { label: 'Cliente', value: client.name },
        { label: 'Serviço(s)', value: serviceNames },
        { label: 'Data e Hora', value: formattedDate },
      ]
    ).catch(err => console.error('Erro ao enviar e-mail de agendamento para o profissional:', err));

    this.notificationsService.emit({
      title: 'Novo Agendamento Realizado',
      body: `O cliente ${client.name} agendou o serviço "${serviceNames}" com ${employee.name} para ${formattedDate}.`,
      type: 'success',
    });

    return customerService;
  }

  async findAll(filterDto: CustomerServiceFilterDto) {
    const { page = 1, limit = 50, startDate, endDate, status } = filterDto;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.CustomerServiceWhereInput = {};
    if (status) {
      whereClause.Status = status;
    }
    if (startDate || endDate) {
      whereClause.Date = {};
      if (startDate) whereClause.Date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) end.setHours(23, 59, 59, 999);
        whereClause.Date.lte = end;
      }
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.customerService.count({ where: whereClause }),
      this.prisma.customerService.findMany({
        where: whereClause,
        orderBy: { Date: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findMyAppointments(employeeId: string) {
    return await this.prisma.customerService.findMany({
      where: {
        PerformedServices: {
          some: {
            idEmployee: employeeId,
          },
        },
      },
      include: {
        Client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            birthDate: true,
            notes: true,
          },
        },
        PerformedServices: {
          include: {
            Service: true,
          },
        },
      },
      orderBy: {
        Date: 'desc',
      },
    });
  }

  findOne(id: string) {
    return this.prisma.customerService.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateCustomerServiceDto: UpdateCustomerServiceDto) {
    const existing = await this.prisma.customerService.findUnique({
      where: { id },
      include: {
        ConsumedItems: true,
        Client: true,
        PerformedServices: {
          include: {
            Employee: true,
            Service: true,
          },
        },
      },
    });

    if (!existing) throw new NotFoundException('Atendimento não encontrado');

    const newStatus = updateCustomerServiceDto.Status;
    const oldStatus = existing.Status;

    if (newStatus === 'CANCELED' && oldStatus !== 'CANCELED' && !updateCustomerServiceDto.cancellationReason) {
      throw new BadRequestException('O motivo do cancelamento é obrigatório.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Baixa de Estoque Opcional (Se houveram produtos consumidos)
      if (
        newStatus === 'COMPLETED' &&
        oldStatus !== 'COMPLETED' &&
        updateCustomerServiceDto.consumedItems
      ) {
        for (const item of updateCustomerServiceDto.consumedItems) {
          const product = await tx.products.findUnique({
            where: { id: item.productId },
          });
          if (!product)
            throw new BadRequestException(
              `Produto ${item.productId} não encontrado.`,
            );
          if (product.stock < item.usedQuantity) {
            throw new BadRequestException(
              `Estoque insuficiente para o produto ${product.name}. Disponível: ${product.stock}`,
            );
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
            category: 'SERVICO_PRESTADO',
            status: 'PAID',
            description: `Faturamento - Atendimento #${id.split('-')[0].toUpperCase()}`,
            amount: existing.TotalValue,
            idCustomerService: id,
          },
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
          where: { idCustomerService: id },
        });
      }

      const { consumedItems, ...restUpdate } = updateCustomerServiceDto;

      return await tx.customerService.update({
        where: { id },
        data: restUpdate as Prisma.CustomerServiceUncheckedUpdateInput,
      });
    });

    // Enviar notificações de forma assíncrona pós-transação de sucesso
    const clientName = existing.Client?.name || 'Cliente';
    const clientEmail = existing.Client?.email;
    const formattedDate = new Date(existing.Date).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const serviceNames = existing.PerformedServices.map((ps) => ps.Service.name).join(', ');
    const uniqueEmployees = Array.from(
      new Map(existing.PerformedServices.map((ps) => [ps.Employee.id, ps.Employee])).values()
    );

    if (newStatus === 'CANCELED' && oldStatus !== 'CANCELED') {
      // E-mail para o Cliente
      if (clientEmail) {
        this.mailService.sendNotification(
          clientEmail,
          'Agendamento Cancelado - Studio A',
          'Seu agendamento foi cancelado',
          `Olá, ${clientName}. Confirmamos o cancelamento do seu agendamento no Studio A.`,
          [
            { label: 'Serviço(s)', value: serviceNames },
            { label: 'Data e Hora', value: formattedDate },
            { label: 'Motivo', value: updateCustomerServiceDto.cancellationReason || 'Não informado' },
          ]
        ).catch(err => console.error('Erro ao notificar cancelamento para cliente:', err));
      }

      // E-mail para os Profissionais
      for (const emp of uniqueEmployees) {
        this.mailService.sendNotification(
          emp.email,
          'Atendimento Cancelado na sua Agenda - Studio A',
          'Um atendimento foi cancelado',
          `Olá, ${emp.name}. O atendimento agendado com você foi cancelado no sistema. Seu horário correspondente está livre agora.`,
          [
            { label: 'Cliente', value: clientName },
            { label: 'Serviço(s)', value: serviceNames },
            { label: 'Data e Hora', value: formattedDate },
            { label: 'Motivo do Cancelamento', value: updateCustomerServiceDto.cancellationReason || 'Não informado' },
          ]
        ).catch(err => console.error('Erro ao notificar cancelamento para profissional:', err));
      }

      // E-mail para os Gerentes
      this.prisma.employee.findMany({ where: { role: 'MANAGER' } })
        .then((managers) => {
          for (const manager of managers) {
            this.mailService.sendNotification(
              manager.email,
              'Alerta de Cancelamento - Studio A',
              'Um agendamento foi cancelado',
              `Olá, ${manager.name}. O agendamento abaixo foi cancelado e retirado da escala do profissional. Qualquer faturamento associado foi removido e os estoques estornados.`,
              [
                { label: 'Cliente', value: clientName },
                { label: 'Serviço(s)', value: serviceNames },
                { label: 'Profissional', value: uniqueEmployees.map(e => e.name).join(', ') },
                { label: 'Data e Hora', value: formattedDate },
                { label: 'Valor Estornado', value: `R$ ${existing.TotalValue.toFixed(2)}` },
              ]
            ).catch(err => console.error('Erro ao notificar cancelamento para gerente:', err));
          }
        })
        .catch(err => console.error('Erro ao buscar gerentes para cancelamento:', err));

      this.notificationsService.emit({
        title: 'Agendamento Cancelado',
        body: `O agendamento de ${clientName} (${serviceNames}) para ${formattedDate} foi cancelado.`,
        type: 'warning',
      });
    }

    if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
      // E-mail para o Cliente
      if (clientEmail) {
        this.mailService.sendNotification(
          clientEmail,
          'Obrigado pela visita! - Studio A',
          'Recibo de Atendimento',
          `Olá, ${clientName}! Agradecemos a sua preferência e visita ao Studio A. Segue o recibo de pagamento do seu atendimento:`,
          [
            { label: 'Serviço(s)', value: serviceNames },
            { label: 'Profissional', value: uniqueEmployees.map(e => e.name).join(', ') },
            { label: 'Data e Hora', value: formattedDate },
            { label: 'Total Pago', value: `R$ ${existing.TotalValue.toFixed(2)}` },
          ]
        ).catch(err => console.error('Erro ao enviar recibo para cliente:', err));
      }

      // E-mail para os Gerentes (Recebimento do Caixa)
      this.prisma.employee.findMany({ where: { role: 'MANAGER' } })
        .then((managers) => {
          for (const manager of managers) {
            this.mailService.sendNotification(
              manager.email,
              'Novo Recebimento de Caixa - Studio A',
              'Faturamento de Atendimento Confirmado',
              `Olá, ${manager.name}. Um novo faturamento foi registrado com a conclusão do atendimento abaixo:`,
              [
                { label: 'Cliente', value: clientName },
                { label: 'Serviço(s)', value: serviceNames },
                { label: 'Profissional', value: uniqueEmployees.map(e => e.name).join(', ') },
                { label: 'Data e Hora', value: formattedDate },
                { label: 'Valor Recebido', value: `R$ ${existing.TotalValue.toFixed(2)}` },
              ]
            ).catch(err => console.error('Erro ao notificar faturamento para gerente:', err));
          }
        })
        .catch(err => console.error('Erro ao buscar gerentes para faturamento:', err));

      this.notificationsService.emit({
        title: 'Faturamento Recebido',
        body: `O atendimento de ${clientName} (${serviceNames}) foi finalizado. Caixa registrado: R$ ${existing.TotalValue.toFixed(2)}.`,
        type: 'success',
      });
    }

    return updated;
  }

  async checkout(id: string, checkoutDto: CheckoutCustomerServiceDto) {
    const existing = await this.prisma.customerService.findUnique({
      where: { id },
      include: { PerformedServices: true },
    });

    if (!existing) throw new NotFoundException('Atendimento não encontrado');
    if (existing.Status === 'COMPLETED') {
      throw new BadRequestException('Atendimento já foi finalizado');
    }

    let finalTotalValue = existing.TotalValue;

    // Calcula o valor final com base no desconto ou preço final
    if (checkoutDto.finalPrice !== undefined) {
      finalTotalValue = checkoutDto.finalPrice;
    } else if (checkoutDto.discount !== undefined) {
      finalTotalValue = Math.max(0, existing.TotalValue - checkoutDto.discount);
    }

    // Ratear o valor final sobre os serviços prestados para que a comissão seja justa
    const ratio =
      existing.TotalValue > 0 ? finalTotalValue / existing.TotalValue : 1;

    return await this.prisma.$transaction(async (tx) => {
      // Atualizar os serviços prestados com o novo preço
      for (const service of existing.PerformedServices) {
        const newPrice = service.priceCharged * ratio;
        const newCommission = newPrice * (service.commissionPercentage / 100);

        await tx.performedServices.update({
          where: { id: service.id },
          data: {
            priceCharged: newPrice,
            commissionValue: newCommission,
          },
        });
      }

      // Atualizar o valor total do atendimento e mudar para COMPLETED
      // Isso NÃO roda a lógica do fluxo de caixa definida em `update`,
      // então precisaremos fechar o atendimento via método update reutilizando a lógica,
      // ou recriar a lógica de caixa aqui. A melhor forma é atualizar os valores
      // e em seguida chamar this.update(id, { Status: 'COMPLETED' })

      await tx.customerService.update({
        where: { id },
        data: { TotalValue: finalTotalValue },
      });
    });

    // Chama o update padrão para gerar o fluxo de caixa
    // e dar baixa no estoque, se aplicável.
    return this.update(id, { Status: 'COMPLETED' });
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
