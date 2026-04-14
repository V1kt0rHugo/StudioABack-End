import { Injectable } from '@nestjs/common';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from 'src/database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService {
  constructor(private prisma: PrismaService) {}
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
      },
      select: {
        id: true,
        name: true,
        email: true,
        CPF: true,
        phone: true,
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
      },
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

    await this.prisma.employee.update({
      data: updateEmployeeDto,
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

  async getCommissions(id: string, startDate?: string, endDate?: string) {
    // 1. Verifica se o funcionário existe no banco de dados
    const employee = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      throw new Error('Funcionário não encontrado');
    }

    // 2. Definindo o período da consulta
    // Se a data não for fornecida pelo front-end, define o mês atual automaticamente
    const now = new Date();
    const start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 3. Busca inteligente no banco de dados com Prisma
    const performedServices = await this.prisma.performedServices.findMany({
      where: {
        idEmployee: id, // Tem que ser serviço prestado por esse funcionário
        CustomerService: {
          Status: 'COMPLETED', // Regra de Ouro: Só comissiona serviços onde o Atendimento foi concluído/pago
          Date: {
            gte: start, // Maior ou igual à data de início...
            lte: end,   // ...e menor ou igual à data de fim
          },
        },
      },
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
      // Cálculo Lógico: Cobrado do Cliente * (Taxa do Serviço / 100)
      const commissionValue = ps.priceCharged * (ps.Service.commissionPercentage / 100);
      
      // Adiciona o valor deste serviço no Saldo Total
      totalCommission += commissionValue;

      // Monta o "Recibo" de cada unidade de serviço feito
      return {
        performedServiceId: ps.id,
        serviceName: ps.Service.name,
        priceCharged: ps.priceCharged,
        commissionPercentage: ps.Service.commissionPercentage,
        commissionValue: commissionValue,
        date: ps.CustomerService.Date,
        customerServiceId: ps.CustomerService.id,
      };
    });

    // 5. Devolve o pacote inteiro formatado para a Aplicação
    return {
      employeeId: id,
      employeeName: employee.name,
      period: {
        start, // Exibe o começo do range consultado
        end,   // Exibe o fim do range consultado
      },
      totalCommission, // A Soma Final
      details: detailedCommissions, // A lista individual pra tela montar o Extrato
    };
  }
}
