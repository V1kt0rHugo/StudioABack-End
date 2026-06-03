import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCashFlowDto } from './dto/create-cash-flow.dto';
import { UpdateCashFlowDto } from './dto/update-cash-flow.dto';
import { CashFlowFilterDto } from './dto/cash-flow-filter.dto';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class CashFlowService {
  constructor(private prisma: PrismaService) {}

  async create(createCashFlowDto: CreateCashFlowDto) {
    const data: any = { ...createCashFlowDto };
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (data.paymentDate) data.paymentDate = new Date(data.paymentDate);
    return await this.prisma.cashFlowTransaction.create({ data });
  }

  async findAll(filterDto: CashFlowFilterDto) {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      status,
      category,
    } = filterDto;
    const skip = (page - 1) * limit;

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
    if (status) whereClause.status = status;
    if (category) whereClause.category = category;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.cashFlowTransaction.count({ where: whereClause }),
      this.prisma.cashFlowTransaction.findMany({
        where: whereClause,
        orderBy: { date: 'desc' },
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

  // Saldo REAL: considera apenas transações PAID
  async getBalance(startDate?: string, endDate?: string) {
    const whereClause: any = { status: 'PAID' };

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) end.setHours(23, 59, 59, 999);
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

  // Previsão: inclui PAID + PENDING (para visão futura do caixa)
  async getForecast(startDate?: string, endDate?: string) {
    const whereClause: any = { status: { in: ['PAID', 'PENDING'] } };

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }

    const transactions = await this.prisma.cashFlowTransaction.findMany({
      where: whereClause,
    });

    const realIncome = transactions
      .filter((t) => t.type === 'INCOME' && t.status === 'PAID')
      .reduce((a, c) => a + c.amount, 0);
    const realExpense = transactions
      .filter((t) => t.type === 'EXPENSE' && t.status === 'PAID')
      .reduce((a, c) => a + c.amount, 0);
    const pendingIncome = transactions
      .filter((t) => t.type === 'INCOME' && t.status === 'PENDING')
      .reduce((a, c) => a + c.amount, 0);
    const pendingExpense = transactions
      .filter((t) => t.type === 'EXPENSE' && t.status === 'PENDING')
      .reduce((a, c) => a + c.amount, 0);

    return {
      period: {
        start: startDate || 'Todo o histórico',
        end: endDate || 'Todo o histórico',
      },
      real: {
        income: realIncome,
        expense: realExpense,
        balance: realIncome - realExpense,
      },
      pending: { income: pendingIncome, expense: pendingExpense },
      projected: {
        balance: realIncome - realExpense + pendingIncome - pendingExpense,
      },
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

    const data: any = { ...updateCashFlowDto };
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (data.paymentDate) data.paymentDate = new Date(data.paymentDate);

    return await this.prisma.cashFlowTransaction.update({
      where: { id },
      data,
    });
  }

  // Marca uma transação PENDING como PAID, registrando a data de pagamento
  async pay(id: string) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({
      where: { id },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');
    if (transaction.status !== 'PENDING') {
      throw new NotFoundException(
        'Apenas transações PENDING podem ser marcadas como pagas',
      );
    }

    return await this.prisma.cashFlowTransaction.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentDate: new Date(),
      },
    });
  }

  async remove(id: string) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({
      where: { id },
    });
    if (!transaction) throw new NotFoundException('Transação não encontrada');
    return await this.prisma.cashFlowTransaction.delete({ where: { id } });
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

    // Apenas transações PAID para stats reais
    const transactions = await this.prisma.cashFlowTransaction.findMany({
      where: { ...whereClause, status: 'PAID' },
      orderBy: { date: 'asc' },
    });

    // Ranking de Serviços (Agrupado via PerformedServices)
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
      const s = serviceStats.get(ps.idService) || {
        name: ps.Service.name,
        count: 0,
        total: 0,
      };
      s.count++;
      s.total += ps.priceCharged;
      serviceStats.set(ps.idService, s);

      const e = employeeStats.get(ps.idEmployee) || {
        name: ps.Employee.name,
        totalRevenue: 0,
        totalCommission: 0,
      };
      e.totalRevenue += ps.priceCharged;
      e.totalCommission += ps.commissionValue;
      employeeStats.set(ps.idEmployee, e);
    });

    // Breakdown por Categoria (Plano de Contas / DRE)
    const categoryBreakdown = new Map<
      string,
      { income: number; expense: number }
    >();
    transactions.forEach((t) => {
      const key = t.category ?? 'OUTROS';
      const entry = categoryBreakdown.get(key) || { income: 0, expense: 0 };
      if (t.type === 'INCOME') entry.income += t.amount;
      else entry.expense += t.amount;
      categoryBreakdown.set(key, entry);
    });

    // Movimentação Diária
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
      categoryBreakdown: Array.from(categoryBreakdown.entries()).map(
        ([category, values]) => ({ category, ...values }),
      ),
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
