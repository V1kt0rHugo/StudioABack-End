import { Injectable, UnauthorizedException } from '@nestjs/common';
import { EmployeeService } from '../employee/employee.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private employeeService: EmployeeService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user: any = await this.employeeService.findByEmailWithPassword(email);

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }

    const client = await this.prisma.client.findUnique({ where: { email } });
    if (client && (await bcrypt.compare(pass, client.password))) {
      if (!client.isEmailVerified) {
        throw new UnauthorizedException(
          'E-mail não verificado. Verifique seu e-mail para ativar a conta.',
        );
      }
      const { password, ...result } = client;
      return { ...result, role: 'CLIENT' };
    }

    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
