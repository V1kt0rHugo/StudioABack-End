import { Injectable } from '@nestjs/common';
import { CreateEmployeeDto, } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from 'src/database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeeService {
  constructor(private prisma: PrismaService) { }
  async create(createEmployeeDto: CreateEmployeeDto) {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createEmployeeDto.password, salt)
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
      }
    })
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
      }
    });
  }

  findOne(id: string) {
    return this.prisma.employee.findUnique({
      where: {
        id
      },
      select: {
        id: true,
        name: true,
        email: true,
        CPF: true,
        phone: true,
      }
    });
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { id }
    });
    if (!employee) throw new Error("Funcionário não encontrado");

    if (updateEmployeeDto.password) {
      const salt = await bcrypt.genSalt();
      updateEmployeeDto.password = await bcrypt.hash(updateEmployeeDto.password, salt);
    }

    await this.prisma.employee.update({
      data: updateEmployeeDto,
      where: { id }
    });

    return { message: "Funcionário atualizado com sucesso" };
  }

  async remove(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id
      }
    });

    if (!employee) {
      throw new Error("Funcionário não encontrado")
    }

    await this.prisma.employee.delete({
      where: {
        id
      }
    });

    return { message: "Funcionário deletado com sucesso" };
  }
}
