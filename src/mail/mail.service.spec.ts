import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailService', () => {
  let service: MailService;

  const mockTransporter = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    (nodemailer.createTestAccount as jest.Mock).mockResolvedValue({
      user: 'test@ethereal.email',
      pass: 'testpass',
    });

    (nodemailer.createTransport as jest.Mock).mockReturnValue(
      mockTransporter,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();

    service = module.get<MailService>(MailService);

    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('sendVerificationCode', () => {
    it('should send verification email successfully', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      (mockTransporter.sendMail as jest.Mock).mockResolvedValue(mockInfo);
      (nodemailer.getTestMessageUrl as jest.Mock).mockReturnValue(
        'https://ethereal.email/test',
      );

      await service.sendVerificationCode('test@example.com', '123456');

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Studio A" <no-reply@studioa.com>',
          to: 'test@example.com',
          subject: 'Verifique sua conta - Código de Segurança',
        }),
      );

      const callArgs = (mockTransporter.sendMail as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.text).toContain('123456');
      expect(callArgs.html).toContain('123456');
    });

    it('should throw error if email sending fails', async () => {
      (mockTransporter.sendMail as jest.Mock).mockRejectedValue(
        new Error('SMTP Error'),
      );

      await expect(
        service.sendVerificationCode('test@example.com', '123456'),
      ).rejects.toThrow('Falha ao enviar e-mail de verificação');
    });

    it('should log warning if transporter is not ready', async () => {
      (nodemailer.createTestAccount as jest.Mock).mockResolvedValue({
        user: 'test@ethereal.email',
        pass: 'testpass',
      });
      (nodemailer.createTransport as jest.Mock).mockReturnValue(undefined);

      const module: TestingModule = await Test.createTestingModule({
        providers: [MailService],
      }).compile();

      const mailServiceWithoutTransporter = module.get<MailService>(
        MailService,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      const loggerWarnSpy = jest.spyOn(
        (mailServiceWithoutTransporter as any).logger,
        'warn',
      );

      await mailServiceWithoutTransporter.sendVerificationCode(
        'test@example.com',
        '123456',
      );

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        'Transporter não está pronto. Ignorando envio.',
      );
    });

    it('should include verification code in both text and html', async () => {
      const mockInfo = { messageId: 'test-message-id' };
      (mockTransporter.sendMail as jest.Mock).mockResolvedValue(mockInfo);

      const code = '654321';
      await service.sendVerificationCode('test@example.com', code);

      const callArgs = (mockTransporter.sendMail as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.text).toContain(code);
      expect(callArgs.html).toContain(code);
    });
  });

  describe('initTestAccount', () => {
    it('should handle Ethereal account creation failure gracefully', async () => {
      (nodemailer.createTestAccount as jest.Mock).mockRejectedValue(
        new Error('Network Error'),
      );

      const module: TestingModule = await Test.createTestingModule({
        providers: [MailService],
      }).compile();

      const mailService = module.get<MailService>(MailService);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect((mailService as any).transporter).toBeUndefined();
    });
  });
});
