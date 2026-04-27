import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class SecurityObscurityFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Se o erro for 401 (Não Logado) ou 403 (Proibido), disfarçamos para 404 (Não Encontrado)
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      return response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: `Cannot ${request.method} ${request.url}`, // Mensagem idêntica ao erro 404 nativo do NestJS
        error: 'Not Found',
      });
    }

    // Para outros erros HTTP, retorna o comportamento normal
    response.status(status).json(exception.getResponse());
  }
}
