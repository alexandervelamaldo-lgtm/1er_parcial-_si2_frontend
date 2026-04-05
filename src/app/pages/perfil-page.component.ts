import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-perfil-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="management-container" *ngIf="profile() as profile">
      <div class="profile-layout">
        
        <header class="profile-header">
          <div class="user-avatar">
            {{ profile.user.email.substring(0, 2).toUpperCase() }}
          </div>
          <div class="user-main-info">
            <h1>Mi Perfil</h1>
            <p>{{ profile.user.email }}</p>
          </div>
          <div class="status-pill" [class.active]="profile.user.is_active">
            <span class="dot"></span>
            {{ profile.user.is_active ? 'Cuenta Activa' : 'Cuenta Inactiva' }}
          </div>
        </header>

        <div class="profile-grid">
          <article class="glass-card">
            <div class="card-header">
              <h3>🔐 Seguridad y Cuenta</h3>
            </div>
            <div class="info-list">
              <div class="info-item">
                <label>Correo Electrónico</label>
                <strong>{{ profile.user.email }}</strong>
              </div>
              <div class="info-item">
                <label>Roles Asignados</label>
                <div class="roles-wrapper">
                  <span class="role-badge" *ngFor="let role of roles()">
                    {{ role }}
                  </span>
                </div>
              </div>
            </div>
          </article>

          <article class="glass-card">
            <div class="card-header">
              <h3>🛠️ Atributos del Sistema</h3>
            </div>
            <div class="ids-grid">
              <div class="id-box" *ngIf="profile.cliente_id">
                <span class="id-label">Módulo Cliente</span>
                <code class="id-value">#{{ profile.cliente_id }}</code>
              </div>
              <div class="id-box" *ngIf="profile.tecnico_id">
                <span class="id-label">Módulo Técnico</span>
                <code class="id-value">#{{ profile.tecnico_id }}</code>
              </div>
              <div class="id-box" *ngIf="profile.operador_id">
                <span class="id-label">Módulo Operador</span>
                <code class="id-value">#{{ profile.operador_id }}</code>
              </div>
            </div>
            <p class="helper-text" *ngIf="!profile.cliente_id && !profile.tecnico_id && !profile.operador_id">
              Tu cuenta es puramente administrativa.
            </p>
          </article>
        </div>

        <footer class="profile-footer">
          <button class="btn-secondary">Cambiar Contraseña</button>
          <button class="btn-danger-light">Cerrar Sesión</button>
        </footer>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --dark: #0f172a; --gray: #64748b; --bg: #f8fafc; --success: #22c55e; }

    .management-container { padding: 2rem; background: var(--bg); min-height: 100vh; font-family: 'Inter', sans-serif; }
    .profile-layout { max-width: 900px; margin: 0 auto; }

    /* Header */
    .profile-header { 
      display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2.5rem; 
      background: white; padding: 2rem; border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.03);
    }
    .user-avatar { 
      width: 80px; height: 80px; background: var(--dark); color: white; 
      border-radius: 20px; display: grid; place-items: center; font-size: 2rem; font-weight: 800; 
    }
    .user-main-info h1 { margin: 0; font-size: 1.75rem; color: var(--dark); }
    .user-main-info p { margin: 0.25rem 0 0; color: var(--gray); font-size: 1.1rem; }

    .status-pill { 
      margin-left: auto; display: flex; align-items: center; gap: 0.5rem; 
      padding: 0.5rem 1rem; border-radius: 100px; font-size: 0.8rem; font-weight: 700;
      background: #fee2e2; color: #ef4444;
    }
    .status-pill.active { background: #dcfce7; color: #15803d; }
    .status-pill .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

    /* Grid */
    .profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem; }
    .glass-card { background: white; padding: 1.5rem; border-radius: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.02); }
    .card-header { margin-bottom: 1.5rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; }
    .card-header h3 { margin: 0; font-size: 1.1rem; color: var(--dark); }

    /* Info */
    .info-item { margin-bottom: 1.25rem; }
    .info-item label { display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--gray); margin-bottom: 0.25rem; }
    .info-item strong { font-size: 1rem; color: var(--dark); }

    .roles-wrapper { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .role-badge { 
      background: #eff6ff; color: var(--primary); padding: 0.25rem 0.75rem; 
      border-radius: 6px; font-size: 0.8rem; font-weight: 700; 
    }

    /* IDs Section */
    .ids-grid { display: grid; gap: 0.75rem; }
    .id-box { 
      background: #f8fafc; padding: 0.75rem 1rem; border-radius: 12px; 
      display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0;
    }
    .id-label { font-size: 0.85rem; color: var(--gray); }
    .id-value { font-family: monospace; font-weight: 700; color: var(--primary); }
    .helper-text { font-size: 0.85rem; color: var(--gray); font-style: italic; }

    /* Footer */
    .profile-footer { margin-top: 2rem; display: flex; gap: 1rem; justify-content: flex-end; }
    button { padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 700; cursor: pointer; border: none; transition: 0.2s; }
    .btn-secondary { background: #f1f5f9; color: var(--dark); }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-danger-light { background: #fff1f2; color: #e11d48; }
    .btn-danger-light:hover { background: #ffe4e6; }
  `
})
export class PerfilPageComponent {
  private readonly authService = inject(AuthService);

  readonly profile = computed(() => this.authService.currentProfile());
  readonly roles = computed(() => this.authService.currentRoles());
}

export {};
