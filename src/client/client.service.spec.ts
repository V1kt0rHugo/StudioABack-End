import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { ClientService } from './client.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import validateEmail from 'deep-email-validator';

jest.mock('bcrypt');
jest.mock('deep-email-validator');

describe('ClientService', () => {
  let service: ClientService;
  let prisma: PrismaService;
  let mailService: MailService;

  const mockPrisma = {
    client: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    customerService: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockMailService = {
    sendVerificationCode: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<ClientService>(ClientService);
    prisma = module.get<PrismaService>(PrismaService);
    mailService = module.get<MailService>(MailService);
  });

  describe('create', () => {
    const createClientDto = {
      name: 'Test Client',
      email: 'test@example.com',
      password: 'SenhaForte@123!',
      phone: '(11) 99999-9999',
      birthDate: '1990-01-01',
      notes: 'Test notes',
    };

    it('should create a client successfully', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);
      (validateEmail as jest.Mock).mockResolvedValue({ valid: true });
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (mockPrisma.client.create as jest.Mock).mockResolvedValue({
        id: '1',
        name: createClientDto.name,
        email: createClientDto.email,
        phone: createClientDto.phone,
        birthDate: new Date(createClientDto.birthDate),
        notes: createClientDto.notes,
      });

      const result = await service.create(createClientDto);

      expect(result.message).toContain('Conta criada com sucesso');
      expect(result.client.email).toBe(createClientDto.email);
      expect(mockPrisma.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: createClientDto.name,
            email: createClientDto.email,
            verificationCode: expect.any(String),
          }),
        }),
      );
      expect(mailService.sendVerificationCode).toHaveBeenCalledWith(
        createClientDto.email,
        expect.any(String),
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: createClientDto.email,
      });

      await expect(service.create(createClientDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(createClientDto)).rejects.toThrow(
        'Este e-mail já está cadastrado',
      );
    });

    it('should throw BadRequestException for disposable email', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);
      (validateEmail as jest.Mock).mockResolvedValue({
        valid: false,
        validators: {
          disposable: { valid: false },
          mx: { valid: true },
          smtp: { valid: true },
        },
      });

      await expect(service.create(createClientDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createClientDto)).rejects.toThrow(
        'Não são aceitos e-mails descartáveis',
      );
    });

    it('should throw BadRequestException for invalid MX records', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);
      (validateEmail as jest.Mock).mockResolvedValue({
        valid: false,
        validators: {
          disposable: { valid: true },
          mx: { valid: false },
          smtp: { valid: true },
        },
      });

      await expect(service.create(createClientDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createClientDto)).rejects.toThrow(
        'O domínio do e-mail não possui registros MX válidos',
      );
    });

    it('should throw BadRequestException for invalid SMTP', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);
      (validateEmail as jest.Mock).mockResolvedValue({
        valid: false,
        validators: {
          disposable: { valid: true },
          mx: { valid: true },
          smtp: { valid: false },
        },
      });

      await expect(service.create(createClientDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create client without birthDate if not provided', async () => {
      const dtoWithoutBirthDate = { ...createClientDto, birthDate: undefined };
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);
      (validateEmail as jest.Mock).mockResolvedValue({ valid: true });
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      (mockPrisma.client.create as jest.Mock).mockResolvedValue({
        id: '1',
        name: createClientDto.name,
        email: createClientDto.email,
      });

      await service.create(dtoWithoutBirthDate);

      expect(mockPrisma.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            birthDate: undefined,
          }),
        }),
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const email = 'test@example.com';
      const code = '123456';

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email,
        isEmailVerified: false,
        verificationCode: code,
      });
      (mockPrisma.client.update as jest.Mock).mockResolvedValue({});

      const result = await service.verifyEmail(email, code);

      expect(result.message).toContain('E-mail verificado com sucesso');
      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { email },
        data: {
          isEmailVerified: true,
          verificationCode: null,
        },
      });
    });

    it('should throw BadRequestException if email not found', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.verifyEmail('notfound@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyEmail('notfound@example.com', '123456'),
      ).rejects.toThrow('E-mail não encontrado');
    });

    it('should throw BadRequestException if email already verified', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        isEmailVerified: true,
      });

      await expect(
        service.verifyEmail('test@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyEmail('test@example.com', '123456'),
      ).rejects.toThrow('Este e-mail já foi verificado');
    });

    it('should throw BadRequestException if code is invalid', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        isEmailVerified: false,
        verificationCode: '654321',
      });

      await expect(
        service.verifyEmail('test@example.com', '123456'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyEmail('test@example.com', '123456'),
      ).rejects.toThrow('Código de verificação inválido');
    });
  });

  describe('resendVerificationCode', () => {
    it('should resend verification code successfully', async () => {
      const email = 'test@example.com';

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email,
        isEmailVerified: false,
      });
      (mockPrisma.client.update as jest.Mock).mockResolvedValue({});

      const result = await service.resendVerificationCode(email);

      expect(result.message).toContain(
        'Novo código de verificação enviado',
      );
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            verificationCode: expect.any(String),
          },
        }),
      );
      expect(mailService.sendVerificationCode).toHaveBeenCalledWith(
        email,
        expect.any(String),
      );
    });

    it('should throw BadRequestException if email not found', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resendVerificationCode('notfound@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if email already verified', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        email: 'test@example.com',
        isEmailVerified: true,
      });

      await expect(
        service.resendVerificationCode('test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated clients without anonymous emails', async () => {
      const filterDto = { page: 1, limit: 10 };

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([
        5,
        [{ id: '1', name: 'Client 1', email: 'client1@example.com' }],
      ]);

      const result = await service.findAll(filterDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(5);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should return filtered clients when search is provided', async () => {
      const filterDto = { page: 1, limit: 10, search: 'John' };

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([
        1,
        [{ id: '1', name: 'John Doe', email: 'john@example.com' }],
      ]);

      const result = await service.findAll(filterDto);

      expect(result.data).toHaveLength(1);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      const filterDto = { page: 2, limit: 5 };

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([
        12,
        [],
      ]);

      const result = await service.findAll(filterDto);

      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('findAllDeleted', () => {
    it('should return only anonymized clients', async () => {
      const deletedClients = [
        { id: '1', name: 'Usuário Deletado', email: 'apagado_1@anonimo.com' },
      ];

      (mockPrisma.client.findMany as jest.Mock).mockResolvedValue(
        deletedClients,
      );

      const result = await service.findAllDeleted();

      expect(result).toEqual(deletedClients);
      expect(mockPrisma.client.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email: { endsWith: '@anonimo.com' },
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a client by id', async () => {
      const client = {
        id: '1',
        name: 'Test Client',
        email: 'test@example.com',
        phone: '(11) 99999-9999',
        birthDate: new Date('1990-01-01'),
        notes: 'Notes',
      };

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(client);

      const result = await service.findOne('1');

      expect(result).toEqual(client);
      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: expect.any(Object),
      });
    });

    it('should return null if client not found', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update client successfully', async () => {
      const updateDto = { name: 'Updated Name' };

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'Old Name',
      });
      (mockPrisma.client.update as jest.Mock).mockResolvedValue({});

      const result = await service.update('1', updateDto);

      expect(result.message).toBe('Usuário atualizado com sucesso');
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: updateDto,
          where: { id: '1' },
        }),
      );
    });

    it('should hash password when updating', async () => {
      const updateDto = { password: 'NewPassword@123!' };

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
      });
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
      (mockPrisma.client.update as jest.Mock).mockResolvedValue({});

      await service.update('1', updateDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword@123!', 'salt');
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            password: 'newHashedPassword',
          }),
        }),
      );
    });

    it('should convert birthDate to Date object when updating', async () => {
      const updateDto = { birthDate: '1995-05-15' };

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
      });
      (mockPrisma.client.update as jest.Mock).mockResolvedValue({});

      await service.update('1', updateDto);

      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            birthDate: new Date('1995-05-15'),
          }),
        }),
      );
    });

    it('should throw Error if client not found', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'Test' }),
      ).rejects.toThrow('Cliente não encontrado');
    });
  });

  describe('remove', () => {
    it('should anonymize client data (soft delete)', async () => {
      const clientId = '1';

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: clientId,
        name: 'Test Client',
      });
      (mockPrisma.client.update as jest.Mock).mockResolvedValue({});

      const result = await service.remove(clientId);

      expect(result.message).toContain('Dados pessoais apagados');
      expect(mockPrisma.client.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: clientId },
          data: expect.objectContaining({
            name: 'Usuário Deletado',
            email: `apagado_${clientId}@anonimo.com`,
            password: '',
            phone: null,
            birthDate: null,
            notes: null,
          }),
        }),
      );
    });

    it('should throw Error if client not found', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        'Cliente não encontrado',
      );
    });
  });

  describe('getClientHistory', () => {
    it('should return client with history and daysPassed', async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const client = {
        id: '1',
        name: 'Test Client',
        email: 'test@example.com',
        phone: '(11) 99999-9999',
        birthDate: new Date('1990-01-01'),
        notes: 'Notes',
        CustomerServices: [
          {
            id: 'cs1',
            Date: fiveDaysAgo,
            Status: 'COMPLETED',
            TotalValue: 100,
            PerformedServices: [],
            ConsumedItems: [],
          },
        ],
      };

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(client);

      const result = await service.getClientHistory('1');

      expect(result.client.id).toBe('1');
      expect(result.history).toHaveLength(1);
      expect(result.history[0].daysPassed).toBe(5);
    });

    it('should return history ordered by date descending', async () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-12-01');

      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        name: 'Test',
        email: 'test@example.com',
        CustomerServices: [
          { id: 'cs1', Date: oldDate, PerformedServices: [], ConsumedItems: [] },
          { id: 'cs2', Date: newDate, PerformedServices: [], ConsumedItems: [] },
        ],
      });

      const result = await service.getClientHistory('1');

      expect(result.history).toHaveLength(2);
      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            CustomerServices: expect.objectContaining({
              orderBy: { Date: 'desc' },
            }),
          },
        }),
      );
    });

    it('should throw Error if client not found', async () => {
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getClientHistory('nonexistent')).rejects.toThrow(
        'Cliente não encontrado',
      );
    });
  });

  describe('getReminders', () => {
    it('should return reminders for services near return date', async () => {
      const fourtyDaysAgo = new Date();
      fourtyDaysAgo.setDate(fourtyDaysAgo.getDate() - 40);

      (mockPrisma.customerService.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cs1',
          Date: fourtyDaysAgo,
          Status: 'COMPLETED',
          Client: {
            id: 'c1',
            name: 'Maria Silva',
            phone: '(11) 99999-9999',
          },
          PerformedServices: [
            {
              Service: {
                name: 'Tintura',
                returnDaysReminder: 45,
              },
            },
          ],
        },
      ]);

      const result = await service.getReminders();

      expect(result).toHaveLength(1);
      expect(result[0].clientId).toBe('c1');
      expect(result[0].serviceName).toBe('Tintura');
      expect(result[0].daysPassed).toBe(40);
      expect(result[0].urgency).toBe('FAZER_RETORNO');
      expect(result[0].suggestedMessage).toContain('Maria');
    });

    it('should mark reminder as ATRASADA if overdue', async () => {
      const fiftyDaysAgo = new Date();
      fiftyDaysAgo.setDate(fiftyDaysAgo.getDate() - 50);

      (mockPrisma.customerService.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cs1',
          Date: fiftyDaysAgo,
          Status: 'COMPLETED',
          Client: {
            id: 'c1',
            name: 'Joana',
            phone: '(11) 99999-9999',
          },
          PerformedServices: [
            {
              Service: {
                name: 'Corte',
                returnDaysReminder: 30,
              },
            },
          ],
        },
      ]);

      const result = await service.getReminders();

      expect(result).toHaveLength(1);
      expect(result[0].urgency).toBe('ATRASADA');
    });

    it('should exclude deleted clients from reminders', async () => {
      (mockPrisma.customerService.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cs1',
          Date: new Date(),
          Status: 'COMPLETED',
          Client: {
            id: 'c1',
            name: 'Usuário Deletado',
            phone: null,
          },
          PerformedServices: [
            {
              Service: {
                name: 'Tintura',
                returnDaysReminder: 45,
              },
            },
          ],
        },
      ]);

      const result = await service.getReminders();

      expect(result).toHaveLength(0);
    });

    it('should ignore services with returnDaysReminder = 0', async () => {
      (mockPrisma.customerService.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cs1',
          Date: new Date(),
          Status: 'COMPLETED',
          Client: {
            id: 'c1',
            name: 'Maria',
            phone: '(11) 99999-9999',
          },
          PerformedServices: [
            {
              Service: {
                name: 'Corte',
                returnDaysReminder: 0,
              },
            },
          ],
        },
      ]);

      const result = await service.getReminders();

      expect(result).toHaveLength(0);
    });

    it('should sort reminders by daysPassed descending', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

      (mockPrisma.customerService.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'cs1',
          Date: tenDaysAgo,
          Status: 'COMPLETED',
          Client: { id: 'c1', name: 'A', phone: '1' },
          PerformedServices: [{ Service: { name: 'S1', returnDaysReminder: 15 } }],
        },
        {
          id: 'cs2',
          Date: twentyDaysAgo,
          Status: 'COMPLETED',
          Client: { id: 'c2', name: 'B', phone: '2' },
          PerformedServices: [{ Service: { name: 'S2', returnDaysReminder: 25 } }],
        },
      ]);

      const result = await service.getReminders();

      expect(result[0].daysPassed).toBeGreaterThan(result[1].daysPassed);
    });
  });
});
