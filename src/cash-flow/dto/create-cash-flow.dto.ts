import {
  IsString,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
} from 'class-validator';
import {
  TransactionType,
  PaymentMethod,
  TransactionCategory,
  TransactionStatus,
} from '@prisma/client';

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

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsEnum(TransactionCategory)
  @IsOptional()
  category?: TransactionCategory;

  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsUUID()
  @IsOptional()
  idCustomerService?: string;
}
