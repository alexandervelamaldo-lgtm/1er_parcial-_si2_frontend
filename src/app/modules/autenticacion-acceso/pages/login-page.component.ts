import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../core/services/autenticacion-acceso/auth.service';
import { TenantService } from '../../../core/services/tenant/tenant.service';
import { TenantAdminService, TenantPublic } from '../../../core/services/tenant/tenant-admin.service';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppIconComponent],
  template: `
    <section class="auth-layout">
      <div class="auth-card">
        <header>
          <div class="brand-icon" aria-hidden="true">
            <app-icon name="shield" [size]="28" />
          </div>
          <span class="tag">Centro de Operaciones</span>
          <h1>Asistencia Vehicular</h1>
          <p>Gestión inteligente de incidentes en tiempo real.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <!-- La organización (tenant) ya NO se pregunta. El backend la
               detecta automáticamente buscando el email en todos los
               tenants configurados y devuelve cuál es en el response. -->

          <div class="form-field">
            <label>Correo Electrónico</label>
            <input
              type="email"
              formControlName="email"
              placeholder="operador@emergency.com"
              autocomplete="email"
            />
          </div>

          <div class="form-field">
            <label>Contraseña</label>
            <input 
              type="password" 
              formControlName="password" 
              placeholder="••••••••" 
              autocomplete="current-password"
            />
          </div>

          <button type="submit" [disabled]="form.invalid || loading()" class="btn-submit">
            <span *ngIf="!loading()">Ingresar al Panel</span>
            <span *ngIf="loading()" class="loader"></span>
          </button>
        </form>

        <footer class="auth-footer">
          <div class="helper-box">
            <strong>Acceso de prueba:</strong>
            <code>operador@emergency.com / Password123*</code>
          </div>
          
          <div class="error-msg" *ngIf="errorMessage()">
            <span class="icon" aria-hidden="true"><app-icon name="alert" [size]="16" /></span>
            <span>{{ errorMessage() }}</span>
          </div>
        </footer>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --primary-dark: #1d4ed8; --bg-dark: #0f172a; }

    .auth-layout {
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      background:
        radial-gradient(ellipse at 20% 50%, rgba(37, 99, 235, 0.08), transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(124, 58, 237, 0.06), transparent 40%),
        radial-gradient(circle at top right, #1e293b, #0f172a);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .auth-card {
      width: min(100%, 420px);
      padding: 2.75rem;
      border-radius: 28px;
      background: #ffffff;
      box-shadow:
        0 25px 50px -12px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05);
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }

    header { text-align: center; margin-bottom: 2rem; }
    
    .brand-icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 1.15rem;
      border-radius: 22px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #eff6ff, #dbeafe);
      color: var(--primary);
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.15);
    }

    .tag {
      display: inline-block;
      padding: 0.3rem 0.85rem;
      background: #eff6ff;
      border-radius: 100px;
      color: var(--primary);
      font-weight: 700;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    h1 { margin: 0.85rem 0 0.3rem; font-size: 1.8rem; color: #1e293b; letter-spacing: -0.03em; font-weight: 800; }
    p { color: #64748b; font-size: 0.95rem; margin: 0; }

    form { display: grid; gap: 1.25rem; }

    .form-field { display: grid; gap: 0.45rem; }
    
    label { font-size: 0.85rem; font-weight: 600; color: #334155; margin-left: 0.15rem; }

    input {
      padding: 0.9rem 1.15rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      font-size: 1rem;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      background: #f8fafc;
    }

    input:focus {
      outline: none;
      border-color: var(--primary);
      background: #fff;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.08);
    }

    .btn-submit {
      margin-top: 0.5rem;
      padding: 1rem;
      border: none;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      color: #fff;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex;
      justify-content: center;
      align-items: center;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
    }

    .btn-submit:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--primary-dark), #1e40af);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.35);
    }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    .auth-footer { margin-top: 1.75rem; text-align: center; }

    .helper-box {
      padding: 1rem;
      background: #f8fafc;
      border-radius: 12px;
      font-size: 0.8rem;
      color: #475569;
      line-height: 1.5;
      border: 1px solid #f1f5f9;
    }

    code { display: block; margin-top: 0.35rem; color: var(--primary); font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; }

    .error-msg {
      margin-top: 1rem;
      padding: 0.85rem;
      background: #fef2f2;
      border-radius: 12px;
      color: #b91c1c;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid #fee2e2;
      display: flex;
      align-items: flex-start;
      gap: 0.55rem;
      text-align: left;
    }

    .icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .loader {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(24px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media (max-width: 480px) {
      .auth-layout { padding: 1rem; }
      .auth-card { padding: 1.75rem; border-radius: 22px; }
      h1 { font-size: 1.5rem; }
      code { word-break: break-word; }
    }
  `
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly tenantAdminApi = inject(TenantAdminService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly errorMessage = signal('');
  /** Public tenant catalog — populates the "Organización" dropdown. */
  readonly tenants = signal<TenantPublic[]>([{ key: 'default', label: 'Default', is_default: true }]);

  readonly form = this.fb.nonNullable.group({
    email: ['operador@emergency.com', [Validators.required, Validators.email]],
    password: ['Password123*', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {
    if (this.route.snapshot.queryParamMap.get('blocked') === 'client') {
      this.errorMessage.set('Los clientes no pueden ingresar desde la web. Usa la aplicación móvil.');
    }
    // Load the tenant catalog so the dropdown is populated. If the call
    // fails (e.g. backend down) we keep the single 'default' option so the
    // user can still attempt to log in.
    this.tenantAdminApi.listPublic().subscribe({
      next: (list) => {
        if (list.length > 0) this.tenants.set(list);
      },
      error: () => { /* keep fallback */ }
    });
  }

  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set('');
    const { email, password } = this.form.getRawValue();

    // Ya no pre-seleccionamos tenant — el backend lo detecta del email
    // y nos lo devuelve en el response, donde auth.service lo guarda.

    this.authService.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        // SUPER_ADMIN no tiene panel operativo — su landing es el listado
        // de tenants. El resto de roles (operador, taller, técnico, admin)
        // siguen entrando al dashboard de incidentes.
        const roles = this.authService.currentRoles();
        const landing = roles.includes('SUPER_ADMIN') ? '/super-admin/tenants' : '/dashboard';
        void this.router.navigate([landing]);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(this.getErrorMessage(error));
      }
    });
  }

  private getErrorMessage(error: { error?: { detail?: unknown }; message?: string }): string {
    const detail = error?.error?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      const normalized = detail.toLowerCase();
      if (
        normalized.includes('connection was closed') ||
        normalized.includes('connection refused') ||
        normalized.includes('econnrefused') ||
        normalized.includes('timeout') ||
        normalized.includes('timed out')
      ) {
        return 'No se pudo conectar al servidor. Verifica que el backend y la base de datos estén activos.';
      }
      return detail;
    }
    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message;
    }
    return 'Credenciales incorrectas o error de conexión.';
  }
}


