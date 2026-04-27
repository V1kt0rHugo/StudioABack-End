import { IsOptional, IsString, IsArray, IsUUID } from 'class-validator';

export class PayCommissionsDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  performedServiceIds?: string[];
}
