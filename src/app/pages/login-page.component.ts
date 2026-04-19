import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="auth-layout">
      <div class="auth-card">
        <header>
          <div class="brand-icon">🚨</div>
          <span class="tag">Centro de Operaciones</span>
          <h1>Asistencia Vehicular</h1>
          <p>Gestión inteligente de incidentes en tiempo real.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()">
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
            <span class="icon">⚠️</span> {{ errorMessage() }}
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
      background: radial-gradient(circle at top right, #1e293b, #0f172a);
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }

    .auth-card {
      width: min(100%, 400px);
      padding: 2.5rem;
      border-radius: 28px;
      background: #ffffff;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.5s ease-out;
    }

    header { text-align: center; margin-bottom: 2rem; }
    
    .brand-icon { font-size: 2.5rem; margin-bottom: 1rem; }

    .tag {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      background: #eff6ff;
      border-radius: 100px;
      color: var(--primary);
      font-weight: 700;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    h1 { margin: 0.75rem 0 0.25rem; font-size: 1.75rem; color: #1e293b; letter-spacing: -0.02em; }
    p { color: #64748b; font-size: 0.95rem; }

    form { display: grid; gap: 1.25rem; }

    .form-field { display: grid; gap: 0.5rem; }
    
    label { font-size: 0.875rem; font-weight: 600; color: #334155; margin-left: 0.25rem; }

    input {
      padding: 0.85rem 1.1rem;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      font-size: 1rem;
      transition: all 0.2s;
      background: #f8fafc;
    }

    input:focus {
      outline: none;
      border-color: var(--primary);
      background: #fff;
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
    }

    .btn-submit {
      margin-top: 0.5rem;
      padding: 1rem;
      border: none;
      border-radius: 12px;
      background: var(--primary);
      color: #fff;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .btn-submit:hover:not(:disabled) { background: var(--primary-dark); transform: translateY(-1px); }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

    .auth-footer { margin-top: 1.5rem; text-align: center; }

    .helper-box {
      padding: 0.85rem;
      background: #f1f5f9;
      border-radius: 12px;
      font-size: 0.8rem;
      color: #475569;
      line-height: 1.4;
    }

    code { display: block; margin-top: 0.25rem; color: var(--primary); font-family: monospace; }

    .error-msg {
      margin-top: 1rem;
      padding: 0.75rem;
      background: #fef2f2;
      border-radius: 10px;
      color: #b91c1c;
      font-size: 0.875rem;
      font-weight: 600;
      border: 1px solid #fee2e2;
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
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 480px) {
      .auth-layout { padding: 1rem; }
      .auth-card { padding: 1.5rem; border-radius: 20px; }
      h1 { font-size: 1.45rem; }
      code { word-break: break-word; }
    }
  `
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['operador@emergency.com', [Validators.required, Validators.email]],
    password: ['Password123*', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {
    if (this.route.snapshot.queryParamMap.get('blocked') === 'client') {
      this.errorMessage.set('Los clientes no pueden ingresar desde la web. Usa la aplicación móvil.');
    }
  }

  submit() {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set('');
    const { email, password } = this.form.getRawValue();

    this.authService.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigate(['/dashboard']);
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
      return detail;
    }
    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message;
    }
    return 'Credenciales incorrectas o error de conexión.';
  }
}
