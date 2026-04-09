import { IsString, IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class CreateEmployeeDto {
    @IsString()
    @IsNotEmpty({ message: 'O nome não pode ser vazio' })
    name: string;

    @IsEmail({}, { message: 'O email deve ser válido' })
    @IsNotEmpty({ message: 'O email não pode ser vazio' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'A senha não pode ser vazia' })
    @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres' })
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, { message: 'A senha deve conter letra maiúscula, minúscula, número e caractere especial' })
    password: string;

    @IsString()
    @IsNotEmpty({ message: 'O CPF não pode ser vazio' })
    @Matches(/^\d{3}\.\d{3}\.\d{3}\-\d{2}$/, { message: 'O CPF deve estar no formato XXX.XXX.XXX-XX' })
    CPF: string;

    @IsString()
    @IsNotEmpty({ message: 'O telefone não pode ser vazio' })
    @Matches(/^\(\d{2}\)\s\d{4,5}\-\d{4}$/, { message: 'O telefone deve estar no formato (XX) XXXX-XXXX ou (XX) XXXXX-XXXX' })
    phone: string;
}
