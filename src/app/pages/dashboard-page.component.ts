import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Solicitud } from '../core/models/api.models';

// Definimos una interfaz para el mapa para evitar el uso de Record genérico
interface IncidentePunto {
  id: number;
  estado: string;
  descripcion: string;
  latitud_incidente: number;
  longitud_incidente: number;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <section class="dashboard-container">
      <header class="page-header">
        <div class="title-group">
          <div class="live-indicator">
            <span class="dot"></span>
            SISTEMA EN VIVO
          </div>
          <h2>Panel de Control Operativo</h2>
          <p>Supervisión de incidentes y despliegue de unidades</p>
        </div>
        <button (click)="loadData()" [disabled]="isLoading()" class="btn-refresh">
          <span class="icon" [class.spinning]="isLoading()">🔄</span>
          {{ isLoading() ? 'Sincronizando...' : 'Actualizar Datos' }}
        </button>
      </header>

      <div class="stats-grid">
        <article class="stat-card">
          <div class="stat-icon blue">📡</div>
          <div class="stat-content">
            <span class="label">Total Activas</span>
            <strong class="value">{{ solicitudes().length }}</strong>
          </div>
        </article>

        <article class="stat-card critical" [class.pulse]="criticas() > 0">
          <div class="stat-icon red">🚨</div>
          <div class="stat-content">
            <span class="label">Prioridad Crítica</span>
            <strong class="value">{{ criticas() }}</strong>
          </div>
        </article>

        <article class="stat-card assigned">
          <div class="stat-icon green">🛠️</div>
          <div class="stat-content">
            <span class="label">Con Técnico</span>
            <strong class="value">{{ asignadas() }}</strong>
          </div>
        </article>
      </div>

      <div class="main-content">
        <div class="panel map-panel">
          <div class="panel-header">
            <h3>📍 Monitor de Ubicaciones</h3>
            <span class="badge-count">{{ mapa().length }} Puntos</span>
          </div>
          <div class="incident-feed">
            <article *ngFor="let punto of mapa()" class="incident-card">
              <div class="card-side-status" [attr.data-status]="punto['estado']"></div>
              <div class="card-body">
                <header>
                  <span class="id">#{{ punto['id'] }}</span>
                  <span class="status-tag">{{ punto['estado'] }}</span>
                </header>
                <p class="desc">{{ punto['descripcion'] }}</p>
                <footer class="coords">
                  <code>{{ punto['latitud_incidente'] | number:'1.4-4' }}, {{ punto['longitud_incidente'] | number:'1.4-4' }}</code>
                </footer>
              </div>
            </article>
          </div>
        </div>

        <div class="panel table-panel">
          <div class="panel-header">
            <h3>📋 Registro de Solicitudes</h3>
          </div>
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Incidente</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Fecha y Hora</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let solicitud of solicitudes()" [class.row-critical]="solicitud.prioridad === 'CRITICA'">
                  <td><span class="mono">#{{ solicitud.id }}</span></td>
                  <td>
                    <div class="incident-type">
                      <strong>{{ solicitud.tipo_incidente?.nombre }}</strong>
                    </div>
                  </td>
                  <td>
                    <span class="state-indicator">{{ solicitud.estado?.nombre }}</span>
                  </td>
                  <td>
                    <span class="badge" [class.critica]="solicitud.prioridad === 'CRITICA'">
                      {{ solicitud.prioridad }}
                    </span>
                  </td>
                  <td class="date-col">{{ solicitud.fecha_solicitud | date: 'dd/MM/yyyy HH:mm' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: `
    :host { --bg: #f8fafc; --dark: #0f172a; --primary: #2563eb; --critical: #ef4444; --success: #22c55e; }

    .dashboard-container { padding: 2rem; background: var(--bg); min-height: 100vh; font-family: 'Inter', sans-serif; }

    /* Header & Live Indicator */
    .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
    .live-indicator { 
      display: flex; align-items: center; gap: 0.5rem; color: var(--success); 
      font-weight: 800; font-size: 0.75rem; letter-spacing: 0.05em; margin-bottom: 0.5rem;
    }
    .dot { width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 8px var(--success); animation: blink 1.5s infinite; }

    /* Stats Cards */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
    .stat-card { 
      background: white; padding: 1.5rem; border-radius: 20px; display: flex; align-items: center; gap: 1.25rem;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05);
    }
    .stat-icon { width: 54px; height: 54px; border-radius: 14px; display: grid; place-items: center; font-size: 1.5rem; }
    .stat-icon.blue { background: #eff6ff; }
    .stat-icon.red { background: #fef2f2; }
    .stat-icon.green { background: #f0fdf4; }
    .stat-card .label { color: #64748b; font-size: 0.875rem; font-weight: 500; }
    .stat-card .value { font-size: 1.8rem; color: var(--dark); display: block; }

    /* Layout Paneles */
    .main-content { display: grid; grid-template-columns: 350px 1fr; gap: 1.5rem; align-items: start; }
    .panel { background: white; border-radius: 20px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); overflow: hidden; }
    .panel-header { padding: 1.25rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
    .panel-header h3 { margin: 0; font-size: 1rem; color: var(--dark); }

    /* Incident Feed */
    .incident-feed { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; max-height: 600px; overflow-y: auto; }
    .incident-card { 
      display: flex; background: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;
      transition: transform 0.2s;
    }
    .incident-card:hover { transform: translateX(5px); border-color: var(--primary); }
    .card-side-status { width: 6px; background: #cbd5e1; }
    .card-side-status[data-status="ACTIVO"] { background: var(--primary); }
    .card-body { padding: 0.75rem; flex: 1; }
    .card-body header { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .id { font-family: monospace; font-weight: 700; color: #64748b; }
    .status-tag { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--primary); }
    .desc { font-size: 0.85rem; color: #334155; margin: 0; line-height: 1.4; }
    .coords { margin-top: 0.5rem; font-size: 0.75rem; color: #94a3b8; }

    /* Tabla */
    .table-responsive { overflow-x: auto; }
    table { width: 100%; min-width: 680px; border-collapse: collapse; }
    th { background: #f8fafc; padding: 1rem; text-align: left; font-size: 0.75rem; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
    td { padding: 1rem; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; color: #334155; }
    tr:hover { background: #fbfcfe; }
    .row-critical { background: #fff1f144; }
    .mono { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #64748b; }
    .badge { padding: 0.35rem 0.75rem; border-radius: 100px; font-weight: 700; font-size: 0.75rem; background: #e0f2fe; color: #0369a1; }
    .badge.critica { background: var(--critical); color: white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2); }

    /* Buttons & Utils */
    .btn-refresh { 
      display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.25rem; 
      background: var(--dark); color: white; border: none; border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s;
    }
    .btn-refresh:hover { background: #1e293b; transform: translateY(-2px); }
    .btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .spinning { animation: spin 1s linear infinite; display: inline-block; }

    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }

    /* Responsive */
    @media (max-width: 1100px) {
      .main-content { grid-template-columns: 1fr; }
      .map-panel { order: 2; }
    }

    @media (max-width: 768px) {
      .dashboard-container { padding: 1rem; }
      .page-header { flex-direction: column; align-items: stretch; gap: 1rem; }
      .btn-refresh { width: 100%; justify-content: center; }
      .stats-grid { grid-template-columns: 1fr; gap: 1rem; }
      .stat-card { padding: 1rem; }
      .panel-header { flex-wrap: wrap; gap: 0.75rem; }
      .incident-card:hover { transform: none; }
      .card-body header { flex-wrap: wrap; gap: 0.5rem; }
      .incident-feed { max-height: none; }
    }

    @media (max-width: 480px) {
      .stat-card { gap: 0.9rem; }
      .stat-icon { width: 46px; height: 46px; font-size: 1.2rem; }
      .stat-card .value { font-size: 1.5rem; }
      th, td { padding: 0.85rem; }
    }
  `
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(EmergencyApiService);

  readonly solicitudes = signal<Solicitud[]>([]);
  readonly mapa = signal<IncidentePunto[]>([]); // Tipado más estricto
  readonly isLoading = signal(false);

  readonly criticas = computed(() => this.solicitudes().filter((item) => item.prioridad === 'CRITICA').length);
  readonly asignadas = computed(() => this.solicitudes().filter((item) => item.tecnico_id).length);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    
    // Usamos un pequeño delay simulado o forkJoin si quisieras coordinar ambas peticiones
    this.api.getSolicitudesActivas().subscribe({
      next: (data) => {
        this.solicitudes.set(data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });

    this.api.getMapaSolicitudes().subscribe({
      next: (data) => this.mapa.set(data as unknown as IncidentePunto[]),
      error: () => this.isLoading.set(false)
    });
  }
}

export {};
