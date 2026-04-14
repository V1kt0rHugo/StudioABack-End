import { Injectable } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from 'src/database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createClientDto.password, salt);
    const client = await this.prisma.client.create({
      data: {
        name: createClientDto.name,
        email: createClientDto.email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
    return client;
  }

  async findAll() {
    return await this.prisma.client.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  async findOne(id: string) {
    return await this.prisma.client.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });
    if (!client) throw new Error('Cliente não encontrado');

    if (updateClientDto.password) {
      const salt = await bcrypt.genSalt();
      updateClientDto.password = await bcrypt.hash(
        updateClientDto.password,
        salt,
      );
    }

    await this.prisma.client.update({
      data: updateClientDto,
      where: { id },
    });

    return { message: 'Usuário atualizado com sucesso' };
  }

  async remove(id: string) {
    const client = await this.prisma.client.findUnique({
      where: {
        id,
      },
    });

    if (!client) {
      throw new Error('Cliente não encontrado');
    }

    await this.prisma.client.delete({
      where: {
        id,
      },
    });

    return { message: 'Usuário deletado com sucesso' };
  }
}
