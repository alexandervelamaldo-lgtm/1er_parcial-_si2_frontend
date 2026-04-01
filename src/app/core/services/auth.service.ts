import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';

import { CurrentUserProfile, LoginResponse } from '../models/api.models';
import { environment } from '../../../environments/environment';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tokenKey = 'emergency_token';

  readonly isAuthenticated = signal<boolean>(this.hasToken());
  readonly currentProfile = signal<CurrentUserProfile | null>(null);
  readonly currentRoles = computed(() => this.currentProfile()?.user.roles.map((role) => role.name) ?? []);

  constructor() {
    if (this.hasToken()) {
      this.loadProfile().subscribe();
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(
        switchMap((response) => {
          localStorage.setItem(this.tokenKey, response.access_token);
          this.isAuthenticated.set(true);
          return this.loadProfile(response.user);
        })
      );
  }

  loadProfile(initialUser?: LoginResponse['user']): Observable<CurrentUserProfile | null> {
    return this.http.get<CurrentUserProfile>(`${environment.apiUrl}/auth/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap((profile) => this.currentProfile.set(profile)),
      catchError(() => {
        const fallbackProfile: CurrentUserProfile | null =
          initialUser
            ? {
                user: initialUser,
                cliente_id: null,
                tecnico_id: null,
                operador_id: null
              }
            : null;
        this.currentProfile.set(fallbackProfile);
        return of<CurrentUserProfile | null>(fallbackProfile);
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this.isAuthenticated.set(false);
    this.currentProfile.set(null);
    void this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  hasToken(): boolean {
    return Boolean(localStorage.getItem(this.tokenKey));
  }

  hasAnyRole(roles: string[]): boolean {
    return this.currentRoles().some((role) => roles.includes(role));
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
