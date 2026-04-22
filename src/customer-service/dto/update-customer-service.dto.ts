import { PartialType } from '@nestjs/swagger';
import { CreateCustomerServiceDto } from './create-customer-service.dto';
import { ServiceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsArray, ValidateNested, IsString, IsUUID, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ConsumedItemDto {
  @IsString()
  @IsUUID()
  productId: string;

  @IsNumber()
  usedQuantity: number;
}

export class UpdateCustomerServiceDto extends PartialType(
  CreateCustomerServiceDto,
) {
  @IsOptional()
  @IsEnum(ServiceStatus)
  Status?: ServiceStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumedItemDto)
  consumedItems?: ConsumedItemDto[];
}
