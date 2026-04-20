import { IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;
  @IsNumber()
  price: number;

  @IsOptional()
  @IsNumber()
  estimatedDuration?: number;
}
