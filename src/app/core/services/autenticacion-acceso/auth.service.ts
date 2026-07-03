import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, of, switchMap, tap, throwError } from 'rxjs';

import { CurrentUserProfile, LoginResponse } from '../../models/gestion-solicitudes/api.models';
import { environment } from '../../../../environments/environment';
import { TenantService } from '../tenant/tenant.service';


/**
 * Clave de localStorage donde vive el JWT de la sesión web. Se exporta para
 * que el `authInterceptor` lea el token SIN inyectar `AuthService` (eso
 * provocaría un ciclo de DI: AuthService → HttpClient → interceptor →
 * AuthService durante la construcción).
 */
export const AUTH_TOKEN_STORAGE_KEY = 'emergency_token';


@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);
  private readonly tokenKey = AUTH_TOKEN_STORAGE_KEY;
  private readonly webClientBlockedMessage = 'Los clientes no pueden ingresar desde la web. Usa la aplicación móvil.';

  readonly isAuthenticated = signal<boolean>(this.hasToken());
  readonly currentProfile = signal<CurrentUserProfile | null>(null);
  readonly currentRoles = computed(() => this.currentProfile()?.user.roles.map((role) => role.name) ?? []);

  constructor() {
    if (this.hasToken()) {
      this.loadProfile().subscribe((profile) => {
        if (this.isWebClientProfile(profile)) {
          this.redirectBlockedClientToLogin();
        }
      });
    }
  }

  login(email: string, password: string) {
    // Ya no enviamos X-Tenant — el backend auto-detecta el tenant
    // iterando organizaciones. El response trae `tenant_key` y nosotros
    // lo persistimos antes de cargar el perfil para que los siguientes
    // requests (incluyendo /auth/me) lleven el header correcto.
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }, {
        headers: new HttpHeaders({
          'X-Client-Platform': 'web',
        })
      })
      .pipe(
        switchMap((response) => {
          localStorage.setItem(this.tokenKey, response.access_token);
          // Guardar el tenant que el backend devolvió. Si el backend no
          // lo mandó (clientes legacy), conservamos el actual.
          if (response.tenant_key) {
            this.tenantService.setTenant(response.tenant_key);
          }
          this.isAuthenticated.set(true);
          return this.loadProfile(response.user);
        }),
        switchMap((profile) => {
          if (this.isWebClientProfile(profile)) {
            this.resetSession();
            return throwError(() => new Error(this.webClientBlockedMessage));
          }
          return of(profile);
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
                operador_id: null,
                taller_id: null
              }
            : null;
        this.currentProfile.set(fallbackProfile);
        return of<CurrentUserProfile | null>(fallbackProfile);
      })
    );
  }

  logout() {
    this.resetSession();
    void this.router.navigate(['/login']);
  }

  isWebClientBlocked(): boolean {
    return this.isWebClientProfile(this.currentProfile());
  }

  resetSession() {
    this.clearSession();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * `true` solo si hay un token Y todavía no expiró. Antes solo comprobaba la
   * EXISTENCIA del string, así que un JWT vencido (vida útil 30 min por
   * defecto) dejaba al usuario en una sesión "zombie": la UI lo creía logueado
   * pero CADA llamada al backend devolvía 401 en silencio (p. ej. el registro
   * del device-token de push). Validar `exp` en cliente hace que el guard
   * mande a /login en vez de admitir esa sesión muerta.
   */
  hasToken(): boolean {
    const token = localStorage.getItem(this.tokenKey);
    if (!token) {
      return false;
    }
    return !this.isTokenExpired(token);
  }

  private isTokenExpired(token: string): boolean {
    const exp = this.readTokenExp(token);
    // Si no podemos leer `exp` (token opaco/malformado) NO bloqueamos en
    // cliente — dejamos que el backend decida. Solo tratamos como vencido lo
    // que demostrablemente venció (con 10 s de tolerancia por desfase de reloj).
    if (exp === null) {
      return false;
    }
    return Date.now() >= exp * 1000 - 10_000;
  }

  private readTokenExp(token: string): number | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(json) as { exp?: unknown };
      return typeof payload.exp === 'number' ? payload.exp : null;
    } catch {
      return null;
    }
  }

  hasAnyRole(roles: string[]): boolean {
    return this.currentRoles().some((role) => roles.includes(role));
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    const tenant = this.tenantService.getTenant();
    const headers: Record<string, string> = { 'X-Tenant': tenant };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return new HttpHeaders(headers);
  }

  private clearSession() {
    localStorage.removeItem(this.tokenKey);
    // CRÍTICO: también limpiar el tenant guardado. Sin esto, el
    // X-Tenant del usuario anterior (especialmente `*` del super-admin)
    // se arrastra a la próxima sesión y el backend rechaza requests
    // con "Token inválido para este tenant".
    this.tenantService.reset();
    this.isAuthenticated.set(false);
    this.currentProfile.set(null);
  }

  private redirectBlockedClientToLogin() {
    this.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: { blocked: 'client' }
    });
  }

  private isWebClientProfile(profile: CurrentUserProfile | null): boolean {
    return profile?.user.roles.some((role) => role.name === 'CLIENTE') ?? false;
  }
}

