import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PayCommissionsDto } from './dto/pay-commissions.dto';
import { PrismaService } from 'src/database/prisma.service';
import { CashFlowService } from 'src/cash-flow/cash-flow.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private cashFlowService: CashFlowService,
  ) { }
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
        Skills: true,
        Schedules: true,
      },
    });
    return employee;
  }

  findAll() {
    return this.prisma.employee.findMany({
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

  async remove(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id,
      },
    });

    if (!employee) {
      throw new Error('Funcionário não encontrado');
    }

    await this.prisma.employee.delete({
      where: {
        id,
      },
    });

    return { message: 'Funcionário deletado com sucesso' };
  }

  async getCommissions(
    id: string, 
    startDate?: string, 
    endDate?: string, 
    paymentStatus?: 'PENDING' | 'PAID' | 'ALL'
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
      const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      
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
    // A Autorização agora é feita pelo RolesGuard na rota, não precisamos checar o requesterId manualmente

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
      throw new BadRequestException('Nenhuma comissão pendente encontrada para os critérios informados.');
    }

    // Agrupar por funcionário para criar lançamentos claros no caixa
    const totalsByEmployee = new Map<string, { employeeName: string; totalAmount: number }>();
    const serviceIdsToUpdate: string[] = [];
    let totalToPay = 0;

    for (const service of pendingServices) {
      serviceIdsToUpdate.push(service.id);
      totalToPay += service.commissionValue;

      const empId = service.idEmployee;
      if (!totalsByEmployee.has(empId)) {
        totalsByEmployee.set(empId, { employeeName: service.Employee.name, totalAmount: 0 });
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
}
