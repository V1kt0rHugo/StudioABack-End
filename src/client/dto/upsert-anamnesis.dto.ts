import { IsOptional, IsString } from 'class-validator';

export class UpsertAnamnesisDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

}
