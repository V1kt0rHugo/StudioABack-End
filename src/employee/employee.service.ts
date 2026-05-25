import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PayCommissionsDto } from './dto/pay-commissions.dto';
import { PrismaService } from 'src/database/prisma.service';
import { CashFlowService } from 'src/cash-flow/cash-flow.service';
import * as bcrypt from 'bcrypt';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private cashFlowService: CashFlowService,
  ) {}
  async create(createEmployeeDto: CreateEmployeeDto) {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createEmployeeDto.password, salt);
    const employee = await this.prisma.employee.create({
      data: {
        name: createEmployeeDto.name,
        email: createEmployeeDto.email,
        password: hashedPassword,
        CPF: createEmployeeDto.CPF,
        phone: createEmployeeDto.phone,
        commissionPercentage: createEmployeeDto.commissionPercentage,
        role: createEmployeeDto.role,
        Skills: {
          connect: createEmployeeDto.skills?.map((id) => ({ id })) || [],
        },
        Schedules: {
          create: createEmployeeDto.schedules || [],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        CPF: true,
        phone: true,
        commissionPercentage: true,
        role: true,
        Skills: true,
        Schedules: true,
      },
    });
    return employee;
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 50 } = paginationDto;
    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.employee.count({ where: { email: { not: { endsWith: '@anonimo.com' } } } }),
      this.prisma.employee.findMany({
        where: { email: { not: { endsWith: '@anonimo.com' } } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          commissionPercentage: true,
          role: true,
          Skills: true,
          Schedules: true,
        },
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

  findOne(id: string) {
    return this.prisma.employee.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        CPF: true,
        phone: true,
        commissionPercentage: true,
        Skills: true,
        Schedules: true,
      },
    });
  }

  async findByEmailWithPassword(email: string) {
    return this.prisma.employee.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });
    if (!employee) throw new Error('Funcionário não encontrado');

    if (updateEmployeeDto.password) {
      const salt = await bcrypt.genSalt();
      updateEmployeeDto.password = await bcrypt.hash(
        updateEmployeeDto.password,
        salt,
      );
    }

    const { skills, schedules, ...restData } = updateEmployeeDto;

    const dataToUpdate: any = { ...restData };

    if (skills) {
      dataToUpdate.Skills = {
        set: skills.map((id) => ({ id })),
      };
    }

    if (schedules) {
      dataToUpdate.Schedules = {
        deleteMany: {}, // Limpa os antigops
        create: schedules, // Cria os novos enviados
      };
    }

    await this.prisma.employee.update({
      data: dataToUpdate,
      where: { id },
    });

    return { message: 'Funcionário atualizado com sucesso' };
  }

  async saveWeekExceptions(id: string, dates: string[], schedules: any[]) {
    // 1. Delete all existing exceptions for these dates
    await this.prisma.employeeSchedule.deleteMany({
      where: {
        employeeId: id,
        date: { in: dates }
      }
    });

    // 2. Insert the new ones
    if (schedules && schedules.length > 0) {
      // Ensure all schedules have employeeId set correctly since we use createMany
      const schedulesToInsert = schedules.map(s => ({
        ...s,
        employeeId: id
      }));
      await this.prisma.employeeSchedule.createMany({
        data: schedulesToInsert
      });
    }

    return { message: 'Exceções de horário salvas com sucesso' };
  }

  async remove(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id,
      },
    });

    if (!employee) {
      throw new Error('Funcionário não encontrado');
    }

    // Soft delete (LGPD - Anonymization)
    await this.prisma.employee.update({
      where: { id },
      data: {
        name: 'Profissional Removido',
        email: `apagado_${id}@anonimo.com`,
        password: '',
        CPF: `***.***.***-${id.substring(0, 2)}`,
        phone: '00000000000',
        Schedules: { deleteMany: {} },
        Skills: { set: [] },
      },
    });

    return { message: 'Funcionário removido com sucesso (Anonimizado)' };
  }

  async getCommissions(
    id: string,
    startDate?: string,
    endDate?: string,
    paymentStatus?: 'PENDING' | 'PAID' | 'ALL',
  ) {
    // 1. Verifica se o funcionário existe no banco de dados
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new Error('Funcionário não encontrado');
    }

    // 2. Definindo o período da consulta
    const whereClause: any = {
      idEmployee: id,
      CustomerService: {
        Status: 'COMPLETED',
      },
    };

    if (startDate || endDate) {
      const now = new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate
        ? new Date(endDate)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      whereClause.CustomerService.Date = {
        gte: start,
        lte: end,
      };
    }

    if (paymentStatus === 'PENDING') {
      whereClause.isCommissionPaid = false;
    } else if (paymentStatus === 'PAID') {
      whereClause.isCommissionPaid = true;
    }

    // 3. Busca inteligente no banco de dados com Prisma
    const performedServices = await this.prisma.performedServices.findMany({
      where: whereClause,
      include: {
        Service: true, // "Puxa" as informações do Serviço (pra ter a porcentagem da comissão)
        CustomerService: true, // "Puxa" as informações do Atendimento (pra ter a data e hora verdadeira)
      },
      orderBy: {
        CustomerService: {
          Date: 'asc', // Ordena cronologicamente do mais velho pro mais novo
        },
      },
    });

    let totalCommission = 0; // Inicia a caixa registradora zerada

    // 4. O Cálculo da Comissão linha por linha
    // O '.map' converte a lista bruta do banco em um Relatório Limpo (o Extrato do Funcionário)
    const detailedCommissions = performedServices.map((ps) => {
      // Adiciona o valor deste serviço no Saldo Total (lido do histórico daquele dia)
      totalCommission += ps.commissionValue;

      // Monta o "Recibo" de cada unidade de serviço feito
      return {
        performedServiceId: ps.id,
        serviceName: ps.Service.name,
        priceCharged: ps.priceCharged,
        commissionPercentage: ps.commissionPercentage,
        commissionValue: ps.commissionValue,
        isCommissionPaid: ps.isCommissionPaid,
        commissionPaidAt: ps.commissionPaidAt,
        date: ps.CustomerService.Date,
        customerServiceId: ps.CustomerService.id,
      };
    });

    // 5. Devolve o pacote inteiro formatado para a Aplicação
    return {
      employeeId: id,
      employeeName: employee.name,
      period: {
        start: startDate || 'Histórico Todo',
        end: endDate || 'Histórico Todo',
      },
      totalCommission, // A Soma Final
      details: detailedCommissions, // A lista individual pra tela montar o Extrato
    };
  }

  async payCommissions(dto: PayCommissionsDto) {
    // 2. Continua o fluxo normal
    const whereClause: any = {
      isCommissionPaid: false,
      CustomerService: { Status: 'COMPLETED' },
    };

    if (dto.performedServiceIds && dto.performedServiceIds.length > 0) {
      whereClause.id = { in: dto.performedServiceIds };
    } else if (dto.employeeId) {
      whereClause.idEmployee = dto.employeeId;
    }

    const pendingServices = await this.prisma.performedServices.findMany({
      where: whereClause,
      include: { Employee: true },
    });

    if (pendingServices.length === 0) {
      throw new BadRequestException(
        'Nenhuma comissão pendente encontrada para os critérios informados.',
      );
    }

    // Agrupar por funcionário para criar lançamentos claros no caixa
    const totalsByEmployee = new Map<
      string,
      { employeeName: string; totalAmount: number }
    >();
    const serviceIdsToUpdate: string[] = [];
    let totalToPay = 0;

    for (const service of pendingServices) {
      serviceIdsToUpdate.push(service.id);
      totalToPay += service.commissionValue;

      const empId = service.idEmployee;
      if (!totalsByEmployee.has(empId)) {
        totalsByEmployee.set(empId, {
          employeeName: service.Employee.name,
          totalAmount: 0,
        });
      }
      totalsByEmployee.get(empId)!.totalAmount += service.commissionValue;
    }

    // 3. Validação de Saldo: O caixa tem dinheiro?
    const currentBalance = await this.cashFlowService.getBalance();
    if (currentBalance.balance < totalToPay) {
      throw new BadRequestException(
        `Saldo insuficiente no caixa para realizar este pagamento. Saldo atual: R$ ${currentBalance.balance.toFixed(2)}. Valor necessário: R$ ${totalToPay.toFixed(2)}.`,
      );
    }

    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      // 1. Atualizar o status das comissões para pagas
      await tx.performedServices.updateMany({
        where: { id: { in: serviceIdsToUpdate } },
        data: {
          isCommissionPaid: true,
          commissionPaidAt: now,
        },
      });

      // 2. Criar as saídas (DESPESAS) no fluxo de caixa agrupadas por funcionário
      // Agora vinculando ao idEmployee para rastreabilidade
      for (const [employeeId, entry] of totalsByEmployee.entries()) {
        await tx.cashFlowTransaction.create({
          data: {
            type: 'EXPENSE',
            category: 'PAGAMENTO_COMISSAO',
            status: 'PAID',
            description: `Pagamento de Comissões - ${entry.employeeName}`,
            amount: entry.totalAmount,
            date: now,
            idEmployee: employeeId,
          },
        });
      }

      return {
        message: 'Comissões pagas com sucesso e registradas no fluxo de caixa.',
        paidServicesCount: serviceIdsToUpdate.length,
        totalPaid: totalToPay,
        remainingBalance: currentBalance.balance - totalToPay,
      };
    });
  }

  async getAvailability(id: string, dateString: string, totalDuration: number = 30) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { Schedules: true },
    });

    if (!employee) throw new BadRequestException('Funcionário não encontrado');

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    const daySchedules = employee.Schedules.filter(
      (s) => s.dayOfWeek === dayOfWeek,
    );
    if (daySchedules.length === 0) return [];

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.customerService.findMany({
      where: {
        PerformedServices: { some: { idEmployee: id } },
        Status: { not: 'CANCELED' },
        Date: { gte: startOfDay, lte: endOfDay },
      },
      select: { Date: true, EndTime: true },
    });

    const slots: { time: string; period: string; status: string; disabled: boolean }[] = [];
    const durationMs = totalDuration * 60000;

    daySchedules.forEach((schedule) => {
      let current = this.parseTime(schedule.startTime, date);
      const end = this.parseTime(schedule.endTime, date);

      // Gera slots de 30 em 30 minutos, mas verifica se a duração TOTAL cabe
      while (current < end) {
        const slotEnd = new Date(current.getTime() + durationMs);

        // Slot fora do horário de trabalho: marcar como indisponível e parar
        if (slotEnd > end) {
          slots.push({
            time: current.toTimeString().substring(0, 5),
            period: current.getHours() < 12 ? 'AM' : 'PM',
            status: 'Lotado',
            disabled: true,
          });
          current = new Date(current.getTime() + 30 * 60000);
          continue;
        }

        // Verifica se ALGUM agendamento sobrepoe o bloco completo [current, slotEnd]
        const isBusy = appointments.some((app) => {
          return (
            (current >= app.Date && current < app.EndTime) ||
            (slotEnd > app.Date && slotEnd <= app.EndTime) ||
            (app.Date >= current && app.Date < slotEnd)
          );
        });

        slots.push({
          time: current.toTimeString().substring(0, 5),
          period: current.getHours() < 12 ? 'AM' : 'PM',
          status: isBusy ? 'Lotado' : 'Disponível',
          disabled: isBusy,
        });

        // Avança sempre de 30 em 30 minutos para exibir todos os slots
        current = new Date(current.getTime() + 30 * 60000);
      }
    });

    return slots;
  }

  private parseTime(timeStr: string, baseDate: Date): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }
}
