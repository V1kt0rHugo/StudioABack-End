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

export class ServiceWithEmployeeDto {
  @IsString()
  @IsUUID()
  serviceId: string;

  @IsString()
  @IsUUID()
  employeeId: string;

  @IsOptional()
  @IsNumber()
  customPrice?: number;
}

export class CreateCustomerServiceDto {
  @IsString()
  @IsUUID()
  idClient: string;

  @IsDateString()
  Date: Date;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceWithEmployeeDto)
  services: ServiceWithEmployeeDto[];
}
