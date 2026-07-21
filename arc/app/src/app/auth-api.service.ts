import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type UserRole = 'trainer' | 'client';

export interface AuthResponse {
  message: string;
  user: {
    id: string;
    email: string | null | undefined;
    role: UserRole | null;
  } | null;
  session: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
  } | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api/auth';

  register(payload: { email: string; password: string; role: UserRole }) {
    return firstValueFrom(
      this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload)
    );
  }

  login(payload: { email: string; password: string }) {
    return firstValueFrom(
      this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload)
    );
  }

  forgotPassword(payload: { email: string }) {
    return firstValueFrom(
      this.http.post<{ message: string }>(`${this.baseUrl}/forgot-password`, payload)
    );
  }

  resetPassword(payload: { accessToken: string; refreshToken: string; password: string }) {
    return firstValueFrom(
      this.http.post<{ message: string }>(`${this.baseUrl}/reset-password`, payload)
    );
  }
}
