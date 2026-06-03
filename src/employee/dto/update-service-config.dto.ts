import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateServiceConfigDto {
  @IsString()
  @IsNotEmpty({ message: 'O ID do serviço não pode ser vazio' })
  idService: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  customDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  customCommission?: number;
}
