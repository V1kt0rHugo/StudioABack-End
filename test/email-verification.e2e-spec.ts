import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { MailService } from '../src/mail/mail.service';
import * as bcrypt from 'bcrypt';
import validateEmail from 'deep-email-validator';

jest.mock('deep-email-validator');

describe('Email Verification E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailService: MailService;
  const testSuffix = Date.now();

  beforeAll(async () => {
    (validateEmail as jest.Mock).mockResolvedValue({ valid: true });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendVerificationCode: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    mailService = moduleFixture.get<MailService>(MailService);

    await prisma.customerService.deleteMany({
      where: {
        Client: {
          email: { contains: `e2e-${testSuffix}` },
        },
      },
    });

    await prisma.client.deleteMany({
      where: {
        email: { contains: `e2e-${testSuffix}` },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /client', () => {
    it('should reject invalid email format', async () => {
      (validateEmail as jest.Mock).mockResolvedValueOnce({
        valid: false,
        validators: {
          mx: { valid: false },
        },
      });

      await request(app.getHttpServer())
        .post('/client')
        .send({
          name: 'Test',
          email: 'test@nonexistent-domain-xyz123.com',
          password: 'SenhaForte@123!',
        })
        .expect(400);
    });

    it('should create client and send verification code', async () => {
      const createClientDto = {
        name: 'E2E Test Client',
        email: `e2e-test-create-${testSuffix}@example.com`,
        password: 'SenhaForte@123!',
        phone: '(11) 99999-9999',
      };

      const response = await request(app.getHttpServer())
        .post('/client')
        .send(createClientDto)
        .expect(201);

      expect(response.body.message).toContain('Conta criada com sucesso');
      expect(response.body.client.email).toBe(createClientDto.email);
      expect(mailService.sendVerificationCode).toHaveBeenCalled();

      const client = await prisma.client.findUnique({
        where: { email: createClientDto.email },
      });

      expect(client).toBeTruthy();
      expect(client!.isEmailVerified).toBe(false);
      expect(client!.verificationCode).toBeTruthy();
    });

    it('should reject duplicate email', async () => {
      const email = `e2e-test-duplicate-${testSuffix}@example.com`;

      await prisma.client.create({
        data: {
          name: 'Existing',
          email,
          password: 'hashed',
          isEmailVerified: false,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/client')
        .send({
          name: 'New Client',
          email,
          password: 'SenhaForte@123!',
        })
        .expect(409);

      expect(response.body.message).toContain('já está cadastrado');
    });
  });

  describe('POST /client/verify', () => {
    const testEmail = `e2e-test-verify-${testSuffix}@example.com`;
    const verificationCode = '123456';

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('SenhaForte@123!', 10);

      await prisma.client.create({
        data: {
          name: 'E2E Verify Test',
          email: testEmail,
          password: hashedPassword,
          verificationCode,
          isEmailVerified: false,
        },
      });
    });

    it('should verify email with correct code', async () => {
      const response = await request(app.getHttpServer())
        .post('/client/verify')
        .send({ email: testEmail, code: verificationCode })
        .expect(201);

      expect(response.body.message).toContain('E-mail verificado com sucesso');

      const client = await prisma.client.findUnique({
        where: { email: testEmail },
      });

      expect(client!.isEmailVerified).toBe(true);
      expect(client!.verificationCode).toBeNull();
    });

    it('should reject already verified email', async () => {
      const response = await request(app.getHttpServer())
        .post('/client/verify')
        .send({ email: testEmail, code: verificationCode })
        .expect(400);

      expect(response.body.message).toContain('já foi verificado');
    });

    it('should reject invalid verification code', async () => {
      const anotherEmail = `e2e-test-invalid-code-${testSuffix}@example.com`;
      const hashedPassword = await bcrypt.hash('SenhaForte@123!', 10);

      await prisma.client.create({
        data: {
          name: 'E2E Invalid Code Test',
          email: anotherEmail,
          password: hashedPassword,
          verificationCode: '654321',
          isEmailVerified: false,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/client/verify')
        .send({ email: anotherEmail, code: '000000' })
        .expect(400);

      expect(response.body.message).toContain('Código de verificação inválido');
    });

    it('should reject non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/client/verify')
        .send({
          email: `nonexistent-${testSuffix}@example.com`,
          code: '123456',
        })
        .expect(400);

      expect(response.body.message).toContain('E-mail não encontrado');
    });

    it('should reject request with invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/client/verify')
        .send({ email: 'invalid-email', code: '123456' })
        .expect(400);
    });

    it('should reject request with invalid code format', async () => {
      await request(app.getHttpServer())
        .post('/client/verify')
        .send({ email: 'test@example.com', code: '123' })
        .expect(400);
    });
  });

  describe('POST /client/resend-verification', () => {
    const testEmail = `e2e-test-resend-${testSuffix}@example.com`;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('SenhaForte@123!', 10);

      await prisma.client.create({
        data: {
          name: 'E2E Resend Test',
          email: testEmail,
          password: hashedPassword,
          verificationCode: 'old-code',
          isEmailVerified: false,
        },
      });
    });

    it('should resend verification code', async () => {
      const response = await request(app.getHttpServer())
        .post('/client/resend-verification')
        .send({ email: testEmail })
        .expect(201);

      expect(response.body.message).toContain(
        'Novo código de verificação enviado',
      );

      const client = await prisma.client.findUnique({
        where: { email: testEmail },
      });

      expect(client!.verificationCode).not.toBe('old-code');
      expect(client!.verificationCode).toBeTruthy();
    });

    it('should reject resend for verified email', async () => {
      const verifiedEmail = `e2e-test-resend-verified-${testSuffix}@example.com`;
      const hashedPassword = await bcrypt.hash('SenhaForte@123!', 10);

      await prisma.client.create({
        data: {
          name: 'E2E Resend Verified Test',
          email: verifiedEmail,
          password: hashedPassword,
          verificationCode: null,
          isEmailVerified: true,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/client/resend-verification')
        .send({ email: verifiedEmail })
        .expect(400);

      expect(response.body.message).toContain('já foi verificado');
    });

    it('should reject resend for non-existent email', async () => {
      const response = await request(app.getHttpServer())
        .post('/client/resend-verification')
        .send({ email: `nonexistent-${testSuffix}@example.com` })
        .expect(400);

      expect(response.body.message).toContain('E-mail não encontrado');
    });
  });

  describe('POST /auth/login with unverified email', () => {
    const unverifiedEmail = `e2e-test-unverified-login-${testSuffix}@example.com`;

    beforeAll(async () => {
      const hashedPassword = await bcrypt.hash('SenhaForte@123!', 10);

      await prisma.client.create({
        data: {
          name: 'E2E Unverified Login Test',
          email: unverifiedEmail,
          password: hashedPassword,
          verificationCode: '123456',
          isEmailVerified: false,
        },
      });
    });

    it('should reject login for unverified client', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: unverifiedEmail,
          password: 'SenhaForte@123!',
        })
        .expect(401);

      expect(response.body.message).toContain('E-mail não verificado');
    });

    it('should allow login after email verification', async () => {
      await prisma.client.update({
        where: { email: unverifiedEmail },
        data: {
          isEmailVerified: true,
          verificationCode: null,
        },
      });

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: unverifiedEmail,
          password: 'SenhaForte@123!',
        })
        .expect(201);

      expect(response.body.access_token).toBeTruthy();
      expect(response.body.user.email).toBe(unverifiedEmail);
    });
  });
});
