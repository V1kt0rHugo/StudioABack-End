import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'O email deve ser válido' })
  @IsNotEmpty({ message: 'O email não pode ser vazio' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'O código não pode ser vazio' })
  @Length(6, 6, { message: 'O código deve ter 6 dígitos' })
  code: string;
}
