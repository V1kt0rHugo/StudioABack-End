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

  async sendNotification(
    to: string,
    subject: string,
    title: string,
    message: string,
    details?: { label: string; value: string }[],
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('Transporter não está pronto. Ignorando envio.');
      return;
    }

    try {
      let detailsHtml = '';
      if (details && details.length > 0) {
        detailsHtml = `
          <div style="margin-top: 20px; border-top: 1px solid rgba(77,70,53,0.3); padding-top: 15px; text-align: left;">
            <table style="width: 100%; border-collapse: collapse;">
              ${details
                .map(
                  (d) => `
                <tr>
                  <td style="padding: 6px 0; color: #99907c; font-size: 14px; width: 40%; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">${d.label}:</td>
                  <td style="padding: 6px 0; color: #e5e2e1; font-size: 14px; text-align: right;">${d.value}</td>
                </tr>
              `,
                )
                .join('')}
            </table>
          </div>
        `;
      }

      const htmlContent = `
        <div style="background-color: #131313; color: #d0c5af; font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif; padding: 40px 20px; min-height: 100%; text-align: center;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1c1b1a; border: 1px solid rgba(77,70,53,0.4); padding: 40px; box-shadow: 0 16px 40px rgba(0,0,0,0.5);">
            <div style="border-bottom: 1px solid rgba(77,70,53,0.4); padding-bottom: 20px; margin-bottom: 30px;">
              <h1 style="color: #f2ca50; font-family: 'Noto Serif', serif; font-size: 28px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Studio A</h1>
              <p style="color: #99907c; font-size: 11px; margin: 5px 0 0 0; letter-spacing: 3px; text-transform: uppercase;">O Ateliê Digital</p>
            </div>
            
            <h2 style="color: #f2ca50; font-family: 'Noto Serif', serif; font-size: 20px; margin-top: 0; margin-bottom: 20px; letter-spacing: 1px;">${title}</h2>
            
            <p style="color: #d0c5af; font-size: 15px; line-height: 1.6; margin-bottom: 20px; text-align: justify;">
              ${message}
            </p>
            
            ${detailsHtml}
            
            <div style="margin-top: 40px; border-top: 1px solid rgba(77,70,53,0.4); padding-top: 20px;">
              <p style="color: #99907c; font-size: 12px; margin: 0;">Este é um e-mail automático enviado por Studio A. Por favor, não responda.</p>
              <p style="color: #f2ca50; font-size: 11px; margin: 10px 0 0 0; letter-spacing: 1px;">© 2026 Studio A — Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      `;

      const info = await this.transporter.sendMail({
        from: '"Studio A" <no-reply@studioa.com>',
        to,
        subject,
        text: `${title}\n\n${message}\n\n` + (details ? details.map(d => `${d.label}: ${d.value}`).join('\n') : ''),
        html: htmlContent,
      });

      this.logger.log(`E-mail de notificação enviado! ID: ${info.messageId}`);
      const testUrl = nodemailer.getTestMessageUrl(info);
      if (testUrl) {
        this.logger.log(`>>> VER E-MAIL ENVIADO: ${testUrl}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao enviar e-mail de notificação para ${to}`, error);
      throw new Error('Falha ao enviar e-mail de notificação');
    }
  }
}
