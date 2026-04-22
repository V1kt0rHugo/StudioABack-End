import { Injectable } from '@nestjs/common';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { PrismaService } from 'src/database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) { }

  async create(createClientDto: CreateClientDto) {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createClientDto.password, salt);
    const client = await this.prisma.client.create({
      data: {
        name: createClientDto.name,
        email: createClientDto.email,
        password: hashedPassword,
        phone: createClientDto.phone,
        birthDate: createClientDto.birthDate ? new Date(createClientDto.birthDate) : undefined,
        notes: createClientDto.notes,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        notes: true,
      },
    });
    return client;
  }

  async findAll() {
    return await this.prisma.client.findMany({
      where: {
        email: { not: { endsWith: '@anonimo.com' } }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        notes: true,
      },
    });
  }

  async findAllDeleted() {
    return await this.prisma.client.findMany({
      where: {
        email: { endsWith: '@anonimo.com' }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        notes: true,      
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
        phone: true,
        birthDate: true,
        notes: true,
      },
    });
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });
    if (!client) throw new Error('Cliente não encontrado');

    const dataToUpdate: any = { ...updateClientDto };

    if (updateClientDto.password) {
      const salt = await bcrypt.genSalt();
      dataToUpdate.password = await bcrypt.hash(
        updateClientDto.password,
        salt,
      );
    }

    if (updateClientDto.birthDate) {
      dataToUpdate.birthDate = new Date(updateClientDto.birthDate);
    }

    await this.prisma.client.update({
      data: dataToUpdate,
      where: { id },
    });

    return { message: 'Usuário atualizado com sucesso' };
  }

  async remove(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      throw new Error('Cliente não encontrado');
    }

    // Lógica de Anonimização (Soft Delete para LGPD)
    await this.prisma.client.update({
      where: { id },
      data: {
        name: 'Usuário Deletado',
        email: `apagado_${id}@anonimo.com`,
        password: '',
        phone: null,
        birthDate: null,
        notes: null,
      },
    });

    return { message: 'Dados pessoais apagados permanentemente com sucesso (Anonimizado)' };
  }

  async getClientHistory(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        CustomerServices: {
          orderBy: { Date: 'desc' },
          include: {
            PerformedServices: {
              include: { Service: true },
            },
            ConsumedItems: {
              include: { Products: true },
            },
          },
        },
      },
    });

    if (!client) throw new Error('Cliente não encontrado');

    const now = new Date();
    const history = client.CustomerServices.map(cs => {
      const diffTime = Math.abs(now.getTime() - new Date(cs.Date).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...cs,
        daysPassed: diffDays,
      };
    });

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        birthDate: client.birthDate,
        notes: client.notes,
      },
      history,
    };
  }

  async getReminders() {
    const completedServices = await this.prisma.customerService.findMany({
      where: { Status: 'COMPLETED' },
      include: {
        Client: { select: { id: true, name: true, phone: true } },
        PerformedServices: {
          include: { Service: true },
        },
      },
    });

    const now = new Date();
    const reminders: any[] = [];

    for (const cs of completedServices) {
      if (!cs.Client || cs.Client.name === 'Usuário Deletado') continue; // Ignora os clientes Soft Deleted (LGPD)

      // Calcula diferença de dias inteiros passados desde a data real do atendimento e o dia de hoje
      const daysPassed = Math.floor((now.getTime() - cs.Date.getTime()) / (1000 * 3600 * 24));

      for (const ps of cs.PerformedServices) {
        // Usa fallback para 0 caso returnDaysReminder seja nulo no banco
        const reminderDays = ps.Service.returnDaysReminder || 0;
        
        if (reminderDays > 0) {
          const daysLeft = reminderDays - daysPassed;

          // Entra na lista de contatos do dia se a cliente já atrasou o retorno ou está a menos de 5 dias do prazo!
          if (daysLeft <= 5) {
            reminders.push({
              clientId: cs.Client.id,
              clientName: cs.Client.name,
              clientPhone: cs.Client.phone,
              serviceName: ps.Service.name,
              serviceDate: cs.Date,
              daysPassed,
              daysTarget: reminderDays,
              urgency: daysLeft < 0 ? 'ATRASADA' : 'FAZER_RETORNO',
              suggestedMessage: `Oi ${cs.Client.name.split(' ')[0]}, tudo bem? Vi aqui sumiu! Já faz ${daysPassed} dias que fizemos o procedimento '${ps.Service.name}', tá na hora de refazer para manter o resultado impecável! Bora agendar?`,
            });
          }
        }
      }
    }

    // Ordena do cliente mais atrasado de todos (maior daysPassed) para o mais recente
    return reminders.sort((a, b) => b.daysPassed - a.daysPassed);
  }
}
