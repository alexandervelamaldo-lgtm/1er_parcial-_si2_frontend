import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../core/services/auth.service';


@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="auth-layout">
      <div class="auth-card">
        <span class="tag">Web para taller y operadores</span>
        <h1>Asistencia de Emergencia Vehicular</h1>
        <p>Accede al panel para gestionar incidentes, técnicos y clientes.</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>
            Correo
            <input type="email" formControlName="email" placeholder="operador@emergency.com" />
          </label>
          <label>
            Contraseña
            <input type="password" formControlName="password" placeholder="Password123*" />
          </label>
          <button type="submit" [disabled]="form.invalid || loading()">Ingresar</button>
        </form>

        <p class="helper">Usuario seed sugerido: operador@emergency.com / Password123*</p>
        <p class="error" *ngIf="errorMessage()">{{ errorMessage() }}</p>
      </div>
    </section>
  `,
  styles: `
    .auth-layout{min-height:100vh;display:grid;place-items:center;padding:2rem;background:linear-gradient(135deg,#07122b,#102a56);}
    .auth-card{width:min(100%,420px);padding:2rem;border-radius:24px;background:#fff;box-shadow:0 24px 80px rgba(0,0,0,.25)}
    .tag{display:inline-block;padding:.35rem .8rem;background:#eef2ff;border-radius:999px;color:#4338ca;font-weight:700;font-size:.8rem}
    h1{margin:1rem 0 .5rem;font-size:2rem;color:#0f172a}
    p{color:#475569}
    form{display:grid;gap:1rem;margin-top:1.5rem}
    label{display:grid;gap:.45rem;color:#0f172a;font-weight:600}
    input{padding:.9rem 1rem;border:1px solid #cbd5e1;border-radius:14px;font-size:1rem}
    button{padding:.95rem 1rem;border:none;border-radius:14px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}
    button:disabled{opacity:.7;cursor:not-allowed}
    .helper{margin-top:1rem;font-size:.9rem;color:#334155}
    .error{margin-top:1rem;color:#b91c1c;font-weight:700}
  `
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['operador@emergency.com', [Validators.required, Validators.email]],
    password: ['Password123*', [Validators.required, Validators.minLength(6)]]
  });

  submit() {
    if (this.form.invalid) {
      return;
    }

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
        this.errorMessage.set(error?.error?.detail ?? 'No se pudo iniciar sesión.');
      }
    });
  }
}
