import { IsUUID, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class SellProductDto {
  @IsUUID()
  productId: string;

  @IsNumber()
  @Min(0.01)
  quantity: number;

  @IsNumber()
  @IsOptional()
  @Min(0.01)
  unitPrice?: number; // Se não informado, usa o preço cadastrado no produto

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;
}
