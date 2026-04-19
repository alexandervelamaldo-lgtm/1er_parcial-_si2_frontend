import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmergencyApiService } from '../core/services/emergency-api.service';
import { Taller, Tecnico, TrabajoRealizadoItem, TrabajoRealizadoResumen } from '../core/models/api.models';

@Component({
  selector: 'app-trabajos-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="management-container">
      <header class="page-header">
        <div>
          <h2>Trabajos realizados</h2>
          <p>Reporte consolidado de trabajos finalizados y pagos confirmados.</p>
        </div>
        <div class="header-actions">
          <button class="btn-secondary" type="button" (click)="exportCsv()" [disabled]="isLoading()">Exportar Excel/CSV</button>
          <button class="btn-primary" type="button" (click)="exportPdf()" [disabled]="isLoading()">Exportar PDF</button>
          <button class="btn-refresh" type="button" (click)="loadData()" [disabled]="isLoading()">Actualizar</button>
        </div>
      </header>

      <section class="filters glass-panel">
        <div class="filters-grid">
          <label>
            Desde
            <input type="date" [(ngModel)]="desde" />
          </label>
          <label>
            Hasta
            <input type="date" [(ngModel)]="hasta" />
          </label>
          <label>
            Técnico
            <select [(ngModel)]="tecnicoId">
              <option [ngValue]="null">Todos</option>
              <option *ngFor="let tecnico of tecnicos()" [ngValue]="tecnico.id">{{ tecnico.nombre }}</option>
            </select>
          </label>
          <label>
            Taller
            <select [(ngModel)]="tallerId">
              <option [ngValue]="null">Todos</option>
              <option *ngFor="let taller of talleres()" [ngValue]="taller.id">{{ taller.nombre }}</option>
            </select>
          </label>
        </div>
        <div class="filters-actions">
          <button class="btn-primary" type="button" (click)="loadData()" [disabled]="isLoading()">Aplicar filtros</button>
          <button class="btn-secondary" type="button" (click)="clearFilters()" [disabled]="isLoading()">Limpiar</button>
        </div>
      </section>

      <section class="summary-grid" *ngIf="resumen() as r">
        <article class="summary-card">
          <span class="label">Trabajos</span>
          <strong>{{ r.cantidad_trabajos }}</strong>
        </article>
        <article class="summary-card">
          <span class="label">Total facturado</span>
          <strong>{{ formatBs(r.total_facturado) }}</strong>
        </article>
        <article class="summary-card">
          <span class="label">Total comisión</span>
          <strong>{{ formatBs(r.total_comision) }}</strong>
        </article>
        <article class="summary-card">
          <span class="label">Total taller</span>
          <strong>{{ formatBs(r.total_taller) }}</strong>
        </article>
        <article class="summary-card">
          <span class="label">Promedio</span>
          <strong>{{ formatBs(r.promedio_por_trabajo) }}</strong>
        </article>
      </section>

      <section class="glass-panel">
        <div class="table-container">
          <table class="modern-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Taller</th>
                <th>Técnico</th>
                <th>Incidente</th>
                <th>Estimado IA</th>
                <th>Costo final</th>
                <th>Total</th>
                <th>Comisión</th>
                <th>Taller</th>
                <th>Método</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="!isLoading() && trabajos().length === 0">
                <td class="empty" colspan="13">No hay trabajos que coincidan con los filtros.</td>
              </tr>
              <tr *ngFor="let item of trabajos()">
                <td>#{{ item.solicitud_id }}</td>
                <td>{{ item.fecha_cierre | date: 'yyyy-MM-dd' }}</td>
                <td>{{ item.cliente }}</td>
                <td>{{ item.taller }}</td>
                <td>{{ item.tecnico }}</td>
                <td>{{ item.tipo_incidente }}</td>
                <td>{{ item.costo_estimado ? formatBs(item.costo_estimado) : '—' }}</td>
                <td>{{ formatBs(item.costo_final) }}</td>
                <td>{{ formatBs(item.monto_total) }}</td>
                <td>{{ formatBs(item.monto_comision) }}</td>
                <td>{{ formatBs(item.monto_taller) }}</td>
                <td>{{ item.metodo_pago }}</td>
                <td><span class="tag tag-success">{{ item.estado_pago }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
    .management-container { padding: 2rem; background: #f6f7fb; min-height: 100vh; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    .page-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .page-header h2 { margin: 0; font-size: 1.7rem; color: #0f172a; }
    .page-header p { margin: 0.25rem 0 0; color: #64748b; }
    .header-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: flex-end; }
    button { border: none; cursor: pointer; font-weight: 700; border-radius: 14px; padding: 0.85rem 1.1rem; transition: 0.2s; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #eef2ff; color: #1d4ed8; }
    .btn-secondary:hover { background: #e0e7ff; }
    .btn-refresh { background: #0f172a; color: #fff; }
    .btn-refresh:hover { background: #111827; }
    .glass-panel { background: rgba(255, 255, 255, 0.92); border: 1px solid rgba(203, 213, 225, 0.6); border-radius: 20px; padding: 1.25rem; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    .filters { margin-bottom: 1.25rem; }
    .filters-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
    label { display: grid; gap: 0.35rem; color: #334155; font-weight: 700; font-size: 0.9rem; }
    input, select { border: 1.5px solid #dbe3ef; border-radius: 12px; padding: 0.8rem 0.95rem; font: inherit; background: #fff; }
    .filters-actions { margin-top: 1rem; display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap; }
    .summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .summary-card { background: #fff; border-radius: 18px; padding: 1rem 1.15rem; border: 1px solid rgba(203, 213, 225, 0.7); }
    .summary-card .label { color: #64748b; font-weight: 700; font-size: 0.85rem; display: block; }
    .summary-card strong { font-size: 1.35rem; color: #0f172a; }
    .table-container { overflow-x: auto; }
    .modern-table { width: 100%; min-width: 1200px; border-collapse: separate; border-spacing: 0; }
    th { text-align: left; padding: 0.95rem; background: #f1f5f9; color: #0f172a; font-size: 0.85rem; border-bottom: 1px solid #e2e8f0; position: sticky; top: 0; }
    td { padding: 0.95rem; border-bottom: 1px solid #eef2f7; color: #0f172a; vertical-align: top; }
    .empty { text-align: center; color: #64748b; font-style: italic; padding: 2.5rem !important; }
    .tag { display: inline-flex; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800; }
    .tag-success { background: rgba(34, 197, 94, 0.12); color: #15803d; }

    @media (max-width: 900px) {
      .management-container { padding: 1rem; }
      .page-header { flex-direction: column; align-items: stretch; }
      .header-actions { justify-content: stretch; }
      .filters-grid { grid-template-columns: 1fr; }
      .summary-grid { grid-template-columns: 1fr; }
      .filters-actions button { width: 100%; }
    }
    `
  ]
})
export class TrabajosPageComponent implements OnInit {
  private readonly api = inject(EmergencyApiService);

  readonly trabajos = signal<TrabajoRealizadoItem[]>([]);
  readonly resumen = signal<TrabajoRealizadoResumen | null>(null);
  readonly tecnicos = signal<Tecnico[]>([]);
  readonly talleres = signal<Taller[]>([]);
  readonly isLoading = signal(false);

  desde = '';
  hasta = '';
  tecnicoId: number | null = null;
  tallerId: number | null = null;

  ngOnInit() {
    this.api.getTecnicos().subscribe((data) => this.tecnicos.set(data));
    this.api.getTalleres().subscribe((data) => this.talleres.set(data));
    this.loadData();
  }

  private getFilters() {
    return {
      desde: this.desde || null,
      hasta: this.hasta || null,
      tecnico_id: this.tecnicoId,
      taller_id: this.tallerId
    };
  }

  loadData() {
    this.isLoading.set(true);
    this.api.getTrabajosRealizados(this.getFilters()).subscribe({
      next: (data) => {
        this.trabajos.set(data.items);
        this.resumen.set(data.resumen);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  clearFilters() {
    this.desde = '';
    this.hasta = '';
    this.tecnicoId = null;
    this.tallerId = null;
    this.loadData();
  }

  exportPdf() {
    window.open(this.api.getTrabajosRealizadosPdfUrl(this.getFilters()), '_blank', 'noopener,noreferrer');
  }

  exportCsv() {
    window.open(this.api.getTrabajosRealizadosCsvUrl(this.getFilters()), '_blank', 'noopener,noreferrer');
  }

  formatBs(amount: number | null | undefined) {
    const safeAmount = Number(amount ?? 0);
    return `Bs ${safeAmount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

