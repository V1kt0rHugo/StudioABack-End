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

  async getBalance() {
    const transactions = await this.prisma.cashFlowTransaction.findMany();
    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
    
    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense
    };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException('Transação não encontrada');
    return transaction;
  }

  async update(id: string, updateCashFlowDto: UpdateCashFlowDto) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException('Transação não encontrada');

    return await this.prisma.cashFlowTransaction.update({
      where: { id },
      data: updateCashFlowDto,
    });
  }

  async remove(id: string) {
    const transaction = await this.prisma.cashFlowTransaction.findUnique({ where: { id } });
    if (!transaction) throw new NotFoundException('Transação não encontrada');

    return await this.prisma.cashFlowTransaction.delete({
      where: { id },
    });
  }
}
