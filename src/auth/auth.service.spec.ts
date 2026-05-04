import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { EmployeeService } from '../employee/employee.service';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let employeeService: EmployeeService;
  let prisma: PrismaService;

  const mockEmployeeService = {
    findByEmailWithPassword: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockPrisma = {
    client: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: EmployeeService, useValue: mockEmployeeService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    employeeService = module.get<EmployeeService>(EmployeeService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('validateUser', () => {
    it('should validate employee successfully', async () => {
      const employee = {
        id: 'emp1',
        email: 'employee@studioa.com',
        name: 'Employee',
        password: 'hashedPassword',
        role: 'MANAGER',
      };

      (mockEmployeeService.findByEmailWithPassword as jest.Mock).mockResolvedValue(
        employee,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'employee@studioa.com',
        'correctPassword',
      );

      expect(result).toEqual({
        id: 'emp1',
        email: 'employee@studioa.com',
        name: 'Employee',
        role: 'MANAGER',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should validate client successfully', async () => {
      const client = {
        id: 'client1',
        email: 'client@example.com',
        name: 'Client',
        password: 'hashedPassword',
        isEmailVerified: true,
      };

      (mockEmployeeService.findByEmailWithPassword as jest.Mock).mockResolvedValue(
        null,
      );
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(client);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'client@example.com',
        'correctPassword',
      );

      expect(result).toEqual({
        id: 'client1',
        email: 'client@example.com',
        name: 'Client',
        isEmailVerified: true,
        role: 'CLIENT',
      });
      expect(result).not.toHaveProperty('password');
    });

    it('should return null if employee password is incorrect', async () => {
      const employee = {
        id: 'emp1',
        email: 'employee@studioa.com',
        name: 'Employee',
        password: 'hashedPassword',
        role: 'MANAGER',
      };

      (mockEmployeeService.findByEmailWithPassword as jest.Mock).mockResolvedValue(
        employee,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser(
        'employee@studioa.com',
        'wrongPassword',
      );

      expect(result).toBeNull();
    });

    it('should return null if client password is incorrect', async () => {
      (mockEmployeeService.findByEmailWithPassword as jest.Mock).mockResolvedValue(
        null,
      );
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue({
        id: 'client1',
        email: 'client@example.com',
        password: 'hashedPassword',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'client@example.com',
        'wrongPassword',
      );

      expect(result).toBeNull();
    });

    it('should throw UnauthorizedException if client email not verified', async () => {
      const client = {
        id: 'client1',
        email: 'client@example.com',
        name: 'Client',
        password: 'hashedPassword',
        isEmailVerified: false,
      };

      (mockEmployeeService.findByEmailWithPassword as jest.Mock).mockResolvedValue(
        null,
      );
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(client);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.validateUser('client@example.com', 'correctPassword'),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.validateUser('client@example.com', 'correctPassword'),
      ).rejects.toThrow('E-mail não verificado');
    });

    it('should return null if user not found', async () => {
      (mockEmployeeService.findByEmailWithPassword as jest.Mock).mockResolvedValue(
        null,
      );
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'anyPassword',
      );

      expect(result).toBeNull();
    });

    it('should check employee first, then fallback to client', async () => {
      const client = {
        id: 'client1',
        email: 'client@example.com',
        name: 'Client',
        password: 'hashedPassword',
        isEmailVerified: true,
      };

      (mockEmployeeService.findByEmailWithPassword as jest.Mock).mockResolvedValue(
        null,
      );
      (mockPrisma.client.findUnique as jest.Mock).mockResolvedValue(client);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'client@example.com',
        'correctPassword',
      );

      expect(mockEmployeeService.findByEmailWithPassword).toHaveBeenCalledWith(
        'client@example.com',
      );
      expect(mockPrisma.client.findUnique).toHaveBeenCalledWith({
        where: { email: 'client@example.com' },
      });
      expect(result.role).toBe('CLIENT');
    });
  });

  describe('login', () => {
    it('should return JWT token and user info for employee', async () => {
      const user = {
        id: 'emp1',
        name: 'Employee',
        email: 'employee@studioa.com',
        role: 'MANAGER',
      };

      (mockJwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await service.login(user);

      expect(result.access_token).toBe('jwt-token');
      expect(result.user).toEqual({
        id: 'emp1',
        name: 'Employee',
        email: 'employee@studioa.com',
        role: 'MANAGER',
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: 'employee@studioa.com',
        sub: 'emp1',
        role: 'MANAGER',
      });
    });

    it('should return JWT token and user info for client', async () => {
      const user = {
        id: 'client1',
        name: 'Client',
        email: 'client@example.com',
        role: 'CLIENT',
      };

      (mockJwtService.sign as jest.Mock).mockReturnValue('jwt-token');

      const result = await service.login(user);

      expect(result.access_token).toBe('jwt-token');
      expect(result.user).toEqual({
        id: 'client1',
        name: 'Client',
        email: 'client@example.com',
        role: 'CLIENT',
      });
    });
  });
});
