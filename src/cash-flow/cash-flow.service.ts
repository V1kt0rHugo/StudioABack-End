import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCashFlowDto } from './dto/create-cash-flow.dto';
import { UpdateCashFlowDto } from './dto/update-cash-flow.dto';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class CashFlowService {
  constructor(private prisma: PrismaService) {}

  async create(createCashFlowDto: CreateCashFlowDto) {
    return await this.prisma.cashFlowTransaction.create({
      data: createCashFlowDto,
    });
  }

  async findAll() {
    return await this.prisma.cashFlowTransaction.findMany({
      orderBy: { date: 'desc' }
    });
  }

  async getBalance(startDate?: string, endDate?: string) {
    const whereClause: any = {};

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(startDate);
      }
      if (endDate) {
        // Garantir que o endDate cubra até o fim do dia (23:59:59) se não houver hora informada
        const end = new Date(endDate);
        if (endDate.length <= 10) { // formato YYYY-MM-DD
           end.setHours(23, 59, 59, 999);
        }
        whereClause.date.lte = end;
      }
    }

    const transactions = await this.prisma.cashFlowTransaction.findMany({
      where: whereClause,
    });

    const totalIncome = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      period: {
        start: startDate || 'Todo o histórico',
        end: endDate || 'Todo o histórico',
      },
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({
      where: { id },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');
    return transaction;
  }

  async update(id: string, updateCashFlowDto: UpdateCashFlowDto) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({
      where: { id },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');

    return await this.prisma.cashFlowTransaction.update({
      where: { id },
      data: updateCashFlowDto,
    });
  }

  async remove(id: string) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({
      where: { id },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');

    return await this.prisma.cashFlowTransaction.delete({
      where: { id },
    });
  }

  async getDashboardStats(startDate?: string, endDate?: string) {
    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }

    // 1. Busca transações para o gráfico de linha e totais
    const transactions = await this.prisma.cashFlowTransaction.findMany({
      where: whereClause,
      orderBy: { date: 'asc' },
    });

    // 2. Ranking de Serviços (Agrupado via PerformedServices)
    // Filtramos apenas atendimentos COMPLETED para o ranking ser real
    const performedServices = await this.prisma.performedServices.findMany({
      where: {
        CustomerService: {
          Status: 'COMPLETED',
          ...(whereClause.date ? { Date: whereClause.date } : {}),
        },
      },
      include: { Service: true, Employee: true },
    });

    const serviceStats = new Map<
      string,
      { name: string; count: number; total: number }
    >();
    const employeeStats = new Map<
      string,
      { name: string; totalRevenue: number; totalCommission: number }
    >();

    performedServices.forEach((ps) => {
      // Stats por Serviço
      const s = serviceStats.get(ps.idService) || {
        name: ps.Service.name,
        count: 0,
        total: 0,
      };
      s.count++;
      s.total += ps.priceCharged;
      serviceStats.set(ps.idService, s);

      // Stats por Funcionário
      const e = employeeStats.get(ps.idEmployee) || {
        name: ps.Employee.name,
        totalRevenue: 0,
        totalCommission: 0,
      };
      e.totalRevenue += ps.priceCharged;
      e.totalCommission += ps.commissionValue;
      employeeStats.set(ps.idEmployee, e);
    });

    // 3. Formatação para Gráfico de Movimentação Diária
    const dailyStats = new Map<
      string,
      { date: string; income: number; expense: number }
    >();
    transactions.forEach((t) => {
      const dateKey = t.date.toISOString().split('T')[0];
      const entry = dailyStats.get(dateKey) || {
        date: dateKey,
        income: 0,
        expense: 0,
      };
      if (t.type === 'INCOME') entry.income += t.amount;
      else entry.expense += t.amount;
      dailyStats.set(dateKey, entry);
    });

    return {
      period: {
        start: startDate || 'Todo o histórico',
        end: endDate || 'Todo o histórico',
      },
      overall: await this.getBalance(startDate, endDate),
      topServices: Array.from(serviceStats.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
      topEmployees: Array.from(employeeStats.values()).sort(
        (a, b) => b.totalRevenue - a.totalRevenue,
      ),
      dailyMovement: Array.from(dailyStats.values()),
    };
  }
}
