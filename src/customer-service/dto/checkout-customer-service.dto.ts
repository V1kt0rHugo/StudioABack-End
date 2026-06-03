import { IsOptional, IsNumber, Min } from 'class-validator';

export class CheckoutCustomerServiceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  finalPrice?: number;
}
