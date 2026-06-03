import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientFilterDto } from './dto/client-filter.dto';
import { UpsertAnamnesisDto } from './dto/upsert-anamnesis.dto';
import { PrismaService } from 'src/database/prisma.service';
import { MailService } from 'src/mail/mail.service';
import * as bcrypt from 'bcrypt';
import validateEmail from 'deep-email-validator';

@Injectable()
export class ClientService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(createClientDto: CreateClientDto) {
    const existingClient = await this.prisma.client.findUnique({
      where: { email: createClientDto.email },
    });
    if (existingClient) {
      throw new ConflictException(
        'Este e-mail já está cadastrado em nosso sistema.',
      );
    }

    // A verificação via DNS/SMTP (deep-email-validator) foi removida porque
    // costuma falhar em ambientes de desenvolvimento (Windows bloqueando porta 53)
    // e também é bloqueada por provedores como o Gmail.
    // O sistema de Código OTP abaixo já é 100% suficiente para garantir que o e-mail existe.

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(createClientDto.password, salt);

    const client = await this.prisma.client.create({
      data: {
        name: createClientDto.name,
        email: createClientDto.email,
        password: hashedPassword,
        phone: createClientDto.phone,
        birthDate: createClientDto.birthDate
          ? new Date(createClientDto.birthDate)
          : undefined,
        notes: createClientDto.notes,
        verificationCode,
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

    await this.mailService.sendVerificationCode(
      createClientDto.email,
      verificationCode,
    );

    return {
      message:
        'Conta criada com sucesso. Verifique seu e-mail para ativar a conta.',
      client,
    };
  }
  async verifyEmail(email: string, code: string) {
    const client = await this.prisma.client.findUnique({
      where: { email },
    });

    if (!client) {
      throw new BadRequestException('E-mail não encontrado');
    }

    if (client.isEmailVerified) {
      throw new BadRequestException('Este e-mail já foi verificado');
    }

    if (client.verificationCode !== code) {
      throw new BadRequestException('Código de verificação inválido');
    }

    await this.prisma.client.update({
      where: { email },
      data: {
        isEmailVerified: true,
        verificationCode: null,
      },
    });

    return {
      message: 'E-mail verificado com sucesso. Sua conta está ativada.',
    };
  }

  async resendVerificationCode(email: string) {
    const client = await this.prisma.client.findUnique({
      where: { email },
    });

    if (!client) {
      throw new BadRequestException('E-mail não encontrado');
    }

    if (client.isEmailVerified) {
      throw new BadRequestException('Este e-mail já foi verificado');
    }

    const verificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    await this.prisma.client.update({
      where: { email },
      data: { verificationCode },
    });

    await this.mailService.sendVerificationCode(email, verificationCode);

    return { message: 'Novo código de verificação enviado por e-mail' };
  }

  async findAll(filterDto: ClientFilterDto) {
    const { page = 1, limit = 50, search } = filterDto;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      email: { not: { endsWith: '@anonimo.com' } },
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.client.count({ where: whereClause }),
      this.prisma.client.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          birthDate: true,
          notes: true,
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

  async findAllDeleted() {
    return await this.prisma.client.findMany({
      where: {
        email: { endsWith: '@anonimo.com' },
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
      dataToUpdate.password = await bcrypt.hash(updateClientDto.password, salt);
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

    return {
      message:
        'Dados pessoais apagados permanentemente com sucesso (Anonimizado)',
    };
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
    const history = client.CustomerServices.map((cs) => {
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

  async getAnamnesis(clientId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new Error('Cliente não encontrado');

    const anamnesis = await this.prisma.clientAnamnesis.findFirst({
      where: { idClient: clientId },
      orderBy: { createdAt: 'desc' },
    });

    return anamnesis || null;
  }

  async upsertAnamnesis(clientId: string, dto: UpsertAnamnesisDto) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new Error('Cliente não encontrado');

    const existing = await this.prisma.clientAnamnesis.findFirst({
      where: { idClient: clientId },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return await this.prisma.clientAnamnesis.update({
        where: { id: existing.id },
        data: {
          notes: dto.notes,
          allergies: dto.allergies,
        },
      });
    } else {
      return await this.prisma.clientAnamnesis.create({
        data: {
          idClient: clientId,
          notes: dto.notes,
          allergies: dto.allergies,
        },
      });
    }
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
      const daysPassed = Math.floor(
        (now.getTime() - cs.Date.getTime()) / (1000 * 3600 * 24),
      );

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

  @Cron(CronExpression.EVERY_HOUR)
  async removeUnverifiedClients() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.prisma.client.deleteMany({
      where: {
        isEmailVerified: false,
        createdAt: {
          lt: oneDayAgo,
        },
      },
    });

    if (result.count > 0) {
      console.log(
        `[Cron] Apagados ${result.count} clientes com e-mail não verificado há mais de 24h.`,
      );
    }
  }
}
