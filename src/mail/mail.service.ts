import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    void this.initTestAccount();
  }

  private async initTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log(
        'Serviço de e-mail (Modo Teste/Ethereal) inicializado com sucesso.',
      );
    } catch (error) {
      this.logger.error('Erro ao inicializar Ethereal Mail', error);
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter não está pronto. Ignorando envio.');
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: '"Studio A" <no-reply@studioa.com>',
        to,
        subject: 'Verifique sua conta - Código de Segurança',
        text: `Olá! Seu código de verificação é: ${code}`,
        html: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h2>Bem-vindo(a) ao Studio A!</h2>
            <p>Para concluir seu cadastro, use o código de verificação abaixo:</p>
            <h1 style="letter-spacing: 5px; color: #4A90E2;">${code}</h1>
            <p>Se você não solicitou este cadastro, pode ignorar este e-mail.</p>
          </div>
        `,
      });
      this.logger.log(`E-mail de verificação enviado! ID: ${info.messageId}`);
      const testUrl = nodemailer.getTestMessageUrl(info);
      if (testUrl) {
        this.logger.log(`>>> VER E-MAIL ENVIADO: ${testUrl}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao enviar e-mail para ${to}`, error);
      throw new Error('Falha ao enviar e-mail de verificação');
    }
  }
}
