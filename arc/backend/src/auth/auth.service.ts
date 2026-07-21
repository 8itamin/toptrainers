import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const publishableKey = this.configService.get<string>('SUPABASE_PUBLISHABLE_KEY');

    if (!url || !publishableKey) {
      throw new InternalServerErrorException('Supabase environment variables are not configured.');
    }

    this.supabase = createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }

  async register(dto: RegisterDto) {
    const { data, error } = await this.supabase.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: {
          role: dto.role
        }
      }
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: data.session
        ? 'Регистрация прошла успешно.'
        : 'Регистрация прошла успешно. Подтвердите почту, если это требуется в настройках Supabase.',
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            role: data.user.user_metadata?.['role'] ?? dto.role
          }
        : null,
      session: data.session
        ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
            expiresAt: data.session.expires_at
          }
        : null
    };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: dto.email,
      password: dto.password
    });

    if (error || !data.user || !data.session) {
      throw new UnauthorizedException(error?.message ?? 'Не удалось выполнить вход.');
    }

    return {
      message: 'Вход выполнен успешно.',
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.user_metadata?.['role'] ?? null
      },
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at
      }
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const redirectTo =
      this.configService.get<string>('SUPABASE_RESET_PASSWORD_REDIRECT') ??
      'http://localhost:4200';

    const { error } = await this.supabase.auth.resetPasswordForEmail(dto.email, {
      redirectTo
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Если аккаунт существует, письмо для сброса пароля отправлено.'
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { error: sessionError } = await this.supabase.auth.setSession({
      access_token: dto.accessToken,
      refresh_token: dto.refreshToken
    });

    if (sessionError) {
      throw new BadRequestException(sessionError.message);
    }

    const { error } = await this.supabase.auth.updateUser({
      password: dto.password
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return {
      message: 'Пароль успешно обновлён. Теперь можно войти с новым паролем.'
    };
  }
}
