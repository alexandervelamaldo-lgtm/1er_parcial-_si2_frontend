import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Tecnico, TecnicoCreatePayload } from '../core/models/api.models';

@Component({
  selector: 'app-tecnicos-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Directorio de Técnicos</h2>
          <p>Personal operativo y disponibilidad en tiempo real</p>
        </div>
        <div class="header-actions">
          <button class="btn-primary" (click)="toggleCreatePanel()">
            {{ showCreatePanel() ? 'Cerrar alta' : 'Nuevo técnico' }}
          </button>
          <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
            <span class="icon" [class.spinning]="isLoading()">🔄</span>
            Actualizar Staff
          </button>
        </div>
      </header>

      <section class="create-panel" *ngIf="showCreatePanel()">
        <div class="panel-header">
          <div>
            <h3>Alta administrativa de técnico</h3>
            <p>El sistema crea acceso autenticable y perfil técnico operativo.</p>
          </div>
          <span class="panel-badge">Rol TECNICO</span>
        </div>

        <div class="form-grid">
          <label>
            Nombre
            <input [(ngModel)]="createForm.nombre" name="nombre" placeholder="María López" />
          </label>
          <label>
            Correo
            <input [(ngModel)]="createForm.email" name="email" type="email" placeholder="tecnico.nuevo@emergency.com" />
          </label>
          <label>
            Teléfono
            <input [(ngModel)]="createForm.telefono" name="telefono" placeholder="70000001" />
          </label>
          <label>
            Contraseña
            <input [(ngModel)]="createForm.password" name="password" type="password" placeholder="Password123*" />
          </label>
          <label>
            Especialidad
            <input [(ngModel)]="createForm.especialidad" name="especialidad" placeholder="Diagnóstico electrónico" />
          </label>
          <label>
            Taller asignado
            <input [(ngModel)]="createForm.taller_id" name="tallerId" type="number" placeholder="Opcional" />
          </label>
        </div>

        <p class="feedback success" *ngIf="successMessage()">{{ successMessage() }}</p>
        <p class="feedback error" *ngIf="errorMessage()">{{ errorMessage() }}</p>

        <div class="panel-actions">
          <button class="btn-refresh" type="button" (click)="resetForm()">Limpiar</button>
          <button class="btn-primary" type="button" (click)="createTecnico()" [disabled]="isSubmitting()">
            {{ isSubmitting() ? 'Creando...' : 'Crear técnico' }}
          </button>
        </div>
      </section>

      <div class="stats-bar">
        <div class="stat-pill">
          <span class="label">Total Personal:</span>
          <strong>{{ tecnicos().length }}</strong>
        </div>
        <div class="stat-pill success">
          <span class="dot pulse"></span>
          <span class="label">Disponibles:</span>
          <strong>{{ disponibles() }}</strong>
        </div>
      </div>

      <div class="tech-grid">
        <article *ngFor="let tecnico of tecnicos()" class="tech-card" [class.off]="!tecnico.disponibilidad">
          <div class="card-header">
            <div class="avatar">
              {{ tecnico.nombre.substring(0, 2).toUpperCase() }}
            </div>
            <div class="status-badge" [class.is-ok]="tecnico.disponibilidad">
              {{ tecnico.disponibilidad ? 'EN SERVICIO' : 'OCUPADO' }}
            </div>
          </div>

          <div class="card-body">
            <h3>{{ tecnico.nombre }}</h3>
            <span class="specialty-tag">{{ tecnico.especialidad }}</span>
            
            <div class="contact-info">
              <a [href]="'tel:' + tecnico.telefono" class="phone-link">
                <span class="icon">📞</span> {{ tecnico.telefono }}
              </a>
            </div>
          </div>

          <div class="card-footer">
            <button class="btn-action" [disabled]="!tecnico.disponibilidad">
              Asignar Directamente
            </button>
          </div>
        </article>
      </div>

      <div *ngIf="tecnicos().length === 0 && !isLoading()" class="empty-state">
        <p>No se encontraron técnicos registrados en el sistema.</p>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --success: #22c55e; --dark: #0f172a; --gray: #64748b; --bg: #f8fafc; }

    .management-container { padding: 2rem; background: var(--bg); min-height: 100vh; font-family: 'Inter', sans-serif; }

    /* Header */
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-header h2 { margin: 0; color: var(--dark); font-size: 1.75rem; letter-spacing: -0.5px; }
    .page-header p { margin: 0.25rem 0 0; color: var(--gray); }
    .header-actions{display:flex;gap:1rem;align-items:center}
    .btn-primary{
      border:none;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;
      border-radius:12px;padding:.75rem 1.2rem;font-weight:700;cursor:pointer
    }

    .create-panel{
      background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:1.5rem;
      margin-bottom:1.5rem;box-shadow:0 10px 30px rgba(15,23,42,.05)
    }
    .panel-header{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}
    .panel-header h3{margin:0 0 .35rem;color:var(--dark)}
    .panel-header p{margin:0;color:var(--gray)}
    .panel-badge{padding:.35rem .75rem;border-radius:999px;background:#eff6ff;color:#1d4ed8;font-weight:700;font-size:.8rem}
    .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}
    .form-grid label{display:grid;gap:.45rem;font-weight:600;color:#334155}
    .form-grid input{border:1.5px solid #dbe3ef;border-radius:12px;padding:.8rem .95rem;font:inherit}
    .feedback{margin:1rem 0 0;font-weight:600}
    .feedback.success{color:#166534}
    .feedback.error{color:#b91c1c}
    .panel-actions{display:flex;justify-content:flex-end;gap:.75rem;margin-top:1rem}

    /* Stats Bar */
    .stats-bar { display: flex; gap: 1rem; margin-bottom: 2rem; }
    .stat-pill { 
      background: white; padding: 0.5rem 1rem; border-radius: 100px; display: flex; align-items: center; gap: 0.75rem;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); font-size: 0.9rem; border: 1px solid #e2e8f0;
    }
    .stat-pill.success { border-color: #dcfce7; color: #166534; }
    .stat-pill strong { color: var(--dark); font-size: 1.1rem; }
    
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); }
    .dot.pulse { animation: pulse-green 2s infinite; }

    /* Grid & Cards */
    .tech-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }

    .tech-card { 
      background: white; border-radius: 24px; padding: 1.5rem; border: 1px solid #f1f5f9;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); transition: all 0.3s ease;
      display: flex; flex-direction: column; position: relative;
    }
    .tech-card:hover { transform: translateY(-5px); box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); border-color: var(--primary); }
    .tech-card.off { opacity: 0.8; background: #fdfdfd; }

    /* Avatar & Status */
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; }
    .avatar { 
      width: 48px; height: 48px; background: var(--dark); color: white; border-radius: 16px;
      display: grid; place-items: center; font-weight: 800; font-size: 1.1rem;
    }
    .status-badge { 
      padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.65rem; font-weight: 900; 
      background: #f1f5f9; color: #64748b; letter-spacing: 0.05em;
    }
    .status-badge.is-ok { background: #dcfce7; color: #166534; }

    /* Body */
    .card-body h3 { margin: 0 0 0.5rem; font-size: 1.25rem; color: var(--dark); }
    .specialty-tag { 
      display: inline-block; padding: 0.25rem 0.6rem; background: #eff6ff; color: var(--primary);
      border-radius: 6px; font-size: 0.75rem; font-weight: 700; margin-bottom: 1.25rem;
    }
    .contact-info { margin-bottom: 1.5rem; }
    .phone-link { 
      text-decoration: none; color: var(--gray); font-family: monospace; font-size: 1rem;
      display: flex; align-items: center; gap: 0.5rem; transition: color 0.2s;
    }
    .phone-link:hover { color: var(--primary); }

    /* Footer / Actions */
    .card-footer { margin-top: auto; }
    .btn-action { 
      width: 100%; padding: 0.75rem; border-radius: 12px; border: none; font-weight: 700;
      background: #f1f5f9; color: var(--dark); cursor: pointer; transition: 0.2s;
    }
    .btn-action:not(:disabled):hover { background: var(--dark); color: white; }
    .btn-action:disabled { cursor: not-allowed; opacity: 0.5; }

    /* Utils */
    .btn-refresh { 
      display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.25rem; 
      background: white; border: 1.5px solid #e2e8f0; border-radius: 12px; font-weight: 600; cursor: pointer;
    }
    .spinning { animation: spin 1s linear infinite; display: inline-block; }
    
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse-green { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }

    .empty-state { text-align: center; padding: 4rem; color: var(--gray); }
  `
})
export class TecnicosPageComponent implements OnInit {
  private readonly api = inject(EmergencyApiService);
  
  readonly tecnicos = signal<Tecnico[]>([]);
  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly showCreatePanel = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly createForm: TecnicoCreatePayload = {
    nombre: '',
    email: '',
    telefono: '',
    password: '',
    especialidad: '',
    taller_id: null,
    disponibilidad: true
  };

  // Computado para la barra de estadísticas
  readonly disponibles = computed(() => 
    this.tecnicos().filter(t => t.disponibilidad).length
  );

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    this.api.getTecnicos().subscribe({
      next: (data) => {
        this.tecnicos.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  toggleCreatePanel() {
    this.showCreatePanel.update((value) => !value);
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  resetForm() {
    this.createForm.nombre = '';
    this.createForm.email = '';
    this.createForm.telefono = '';
    this.createForm.password = '';
    this.createForm.especialidad = '';
    this.createForm.taller_id = null;
    this.createForm.disponibilidad = true;
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  createTecnico() {
    if (!this.createForm.nombre || !this.createForm.email || !this.createForm.password || !this.createForm.telefono || !this.createForm.especialidad) {
      this.errorMessage.set('Completa nombre, correo, contraseña, teléfono y especialidad.');
      this.successMessage.set('');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.api.createTecnico({
      nombre: this.createForm.nombre.trim(),
      email: this.createForm.email.trim(),
      password: this.createForm.password,
      telefono: this.createForm.telefono.trim(),
      especialidad: this.createForm.especialidad.trim(),
      taller_id: this.createForm.taller_id ?? null,
      disponibilidad: true
    }).subscribe({
      next: (tecnico) => {
        this.tecnicos.update((items) => [tecnico, ...items]);
        const email = this.createForm.email;
        this.resetForm();
        this.showCreatePanel.set(false);
        this.successMessage.set(`Técnico creado correctamente. Acceso: ${email}`);
        this.isSubmitting.set(false);
      },
      error: (error) => {
        const detail = error?.error?.detail;
        this.errorMessage.set(typeof detail === 'string' ? detail : 'No se pudo crear el técnico.');
        this.isSubmitting.set(false);
      }
    });
  }
}

export {};
