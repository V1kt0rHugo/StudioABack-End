import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  ValidateNested,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ServiceItemDto {
  @IsString()
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsNumber()
  customPrice?: number;
}

export class CreateCustomerServiceDto {
  @IsString()
  @IsUUID()
  idClient: string;

  @IsString()
  @IsUUID()
  employeeId: string;

  @IsDateString()
  Date: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceItemDto)
  services: ServiceItemDto[];
}
