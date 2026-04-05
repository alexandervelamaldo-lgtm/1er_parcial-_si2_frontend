import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Tecnico } from '../core/models/api.models';

@Component({
  selector: 'app-tecnicos-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Directorio de Técnicos</h2>
          <p>Personal operativo y disponibilidad en tiempo real</p>
        </div>
        <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
          <span class="icon" [class.spinning]="isLoading()">🔄</span>
          Actualizar Staff
        </button>
      </header>

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
}

export {};
