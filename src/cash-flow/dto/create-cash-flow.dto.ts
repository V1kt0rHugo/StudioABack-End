import { IsString, IsNumber, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateCashFlowDto {
  @IsEnum(TransactionType)
  @IsNotEmpty()
  type: TransactionType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsUUID()
  @IsOptional()
  idCustomerService?: string;
}
