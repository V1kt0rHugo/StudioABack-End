import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ServiceStatus } from '@prisma/client';

export class CustomerServiceFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}
