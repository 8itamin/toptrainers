import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  accessToken!: string;

  @IsString()
  refreshToken!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
