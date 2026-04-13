import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import {
  EstadoSolicitudOption,
  SolicitudCandidatos,
  SolicitudDetalle,
  SolicitudSeguimiento
} from '../core/models/api.models';
import { AuthService } from '../core/services/auth.service';
import { EmergencyApiService } from '../core/services/emergency-api.service';

@Component({
  selector: 'app-solicitud-detalle-page',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="detail-container" *ngIf="solicitud() as solicitud">
      <header class="detail-header">
        <a routerLink="/solicitudes" class="btn-back">← Volver al Listado</a>
        <div class="header-main">
          <div class="title-info">
            <h1>Solicitud #{{ solicitud.id }}</h1>
            <span class="badge-status" [attr.data-status]="solicitud.estado?.nombre">{{ solicitud.estado?.nombre }}</span>
          </div>
          <div class="priority-tag" [attr.data-priority]="solicitud.prioridad">Prioridad {{ solicitud.prioridad }}</div>
        </div>
      </header>

      <div class="main-grid">
        <div class="content-column">
          <article class="glass-card">
            <div class="card-header">
              <h3>Información General</h3>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <label>Tipo de Incidente</label>
                <strong>{{ solicitud.tipo_incidente?.nombre }}</strong>
              </div>
              <div class="info-item">
                <label>Fecha Reporte</label>
                <strong>{{ solicitud.fecha_solicitud | date: 'medium' }}</strong>
              </div>
              <div class="info-item">
                <label>Taller propuesto</label>
                <strong>{{ seguimiento()?.taller_nombre || 'Pendiente' }}</strong>
              </div>
              <div class="info-item">
                <label>Aprobación cliente</label>
                <strong>{{ approvalLabel(solicitud.cliente_aprobada) }}</strong>
              </div>
              <div class="info-item">
                <label>Contexto vial</label>
                <strong>{{ solicitud.es_carretera ? 'Carretera' : 'Zona urbana' }}</strong>
              </div>
              <div class="info-item">
                <label>Riesgo reportado</label>
                <strong>{{ solicitud.nivel_riesgo ?? '--' }}/5</strong>
              </div>
              <div class="info-item">
                <label>Condición del vehículo</label>
                <strong>{{ solicitud.condicion_vehiculo || 'Sin dato' }}</strong>
              </div>
              <div class="info-item full">
                <label>Descripción</label>
                <p>{{ solicitud.descripcion }}</p>
              </div>
              <div class="info-item">
                <label>Coordenadas</label>
                <code>{{ solicitud.latitud_incidente }}, {{ solicitud.longitud_incidente }}</code>
              </div>
              <div class="info-item" *ngIf="solicitud.propuesta_expira_en">
                <label>Expiración propuesta</label>
                <strong>{{ solicitud.propuesta_expira_en | date: 'short' }}</strong>
              </div>
            </div>
          </article>

          <article class="glass-card estimate-card">
            <div class="card-header">
              <h3>Costo estimado</h3>
              <span class="metric-pill" *ngIf="solicitud.costo_estimacion_confianza !== null && solicitud.costo_estimacion_confianza !== undefined">
                Confianza {{ (solicitud.costo_estimacion_confianza * 100) | number: '1.0-0' }}%
              </span>
            </div>
            <ng-container *ngIf="hasEstimatedCost(); else noEstimate">
              <div class="estimate-main">
                <strong>{{ solicitud.costo_estimado | currency }}</strong>
                <span>aproximado</span>
              </div>
              <p class="subtle" *ngIf="solicitud.costo_estimado_min !== null && solicitud.costo_estimado_max !== null">
                Rango esperado {{ solicitud.costo_estimado_min | currency }} a {{ solicitud.costo_estimado_max | currency }}
              </p>
              <p class="subtle" *ngIf="solicitud.costo_estimacion_nota">{{ solicitud.costo_estimacion_nota }}</p>
            </ng-container>
            <ng-template #noEstimate>
              <p class="subtle">La estimación aún no está disponible para esta solicitud.</p>
            </ng-template>
          </article>

          <article class="glass-card ia-insight" *ngIf="showAiBlock()">
            <div class="card-header">
              <h3>Análisis IA</h3>
            </div>
            <div class="ia-metrics">
              <span class="metric-pill" *ngIf="solicitud.clasificacion_confianza !== null && solicitud.clasificacion_confianza !== undefined">
                Confianza {{ (solicitud.clasificacion_confianza * 100) | number: '1.0-0' }}%
              </span>
              <span class="metric-pill" *ngIf="solicitud.proveedor_ia">Proveedor {{ solicitud.proveedor_ia }}</span>
              <span class="metric-pill warning" *ngIf="solicitud.requiere_revision_manual">Revisión manual</span>
            </div>
            <p class="resumen" *ngIf="solicitud.resumen_ia">{{ solicitud.resumen_ia }}</p>
            <p class="subtle" *ngIf="solicitud.motivo_prioridad">{{ solicitud.motivo_prioridad }}</p>
            <div class="tag-list" *ngIf="aiTags().length">
              <span class="tag" *ngFor="let tag of aiTags()">{{ tag }}</span>
            </div>
            <div class="alert-box" *ngIf="solicitud.transcripcion_audio">
              <strong>Transcripción de audio</strong>
              <p>{{ solicitud.transcripcion_audio }}</p>
            </div>
          </article>

          <article class="glass-card" *ngIf="solicitud.evidencias.length">
            <div class="card-header">
              <h3>Evidencias</h3>
            </div>
            <ul class="stack-list">
              <li *ngFor="let ev of solicitud.evidencias">
                <strong>{{ ev.tipo }}</strong>
                <span>{{ ev.nombre_archivo || ev.contenido_texto || 'Archivo adjunto' }}</span>
              </li>
            </ul>
          </article>

          <article class="glass-card">
            <div class="card-header">
              <h3>Pagos y comisión</h3>
            </div>
            <div class="payment-summary" *ngIf="latestPayment() as latest; else noPayment">
              <div class="payment-main">
                <strong>{{ latest.monto_total | currency }}</strong>
                <span class="tag" [class.tag-success]="latest.estado === 'PAGADO'">{{ latest.estado }}</span>
              </div>
              <p class="subtle">
                Método {{ latest.metodo_pago }} · Taller {{ latest.monto_taller | currency }} · Comisión {{ latest.monto_comision | currency }}
              </p>
              <p class="subtle" *ngIf="latest.referencia_externa">Referencia {{ latest.referencia_externa }}</p>
            </div>
            <ng-template #noPayment>
              <p class="subtle">Todavía no hay pagos registrados para esta solicitud.</p>
            </ng-template>
            <div class="payment-item" *ngFor="let pago of solicitud.pagos">
              <div class="payment-main">
                <strong>{{ pago.monto_total | currency }}</strong>
                <span class="tag" [class.tag-success]="pago.estado === 'PAGADO'">{{ pago.estado }}</span>
              </div>
              <small>{{ pago.metodo_pago }} · Taller {{ pago.monto_taller | currency }} · Comisión {{ pago.monto_comision | currency }}</small>
            </div>
          </article>

          <article class="glass-card" *ngIf="solicitud.disputas.length">
            <div class="card-header">
              <h3>Disputas y soporte</h3>
            </div>
            <div class="stack-list">
              <div *ngFor="let disputa of solicitud.disputas">
                <strong>{{ disputa.motivo }}</strong>
                <p>{{ disputa.detalle }}</p>
                <small>{{ disputa.estado }}</small>
              </div>
            </div>
          </article>

          <article class="glass-card">
            <div class="card-header">
              <h3>Historial</h3>
            </div>
            <div class="timeline">
              <div class="timeline-event" *ngFor="let evento of solicitud.historial">
                <div class="event-dot"></div>
                <div class="event-content">
                  <div class="event-header">
                    <strong>{{ evento.estado_anterior }} → {{ evento.estado_nuevo }}</strong>
                    <span class="event-time">{{ evento.fecha_evento | date: 'short' }}</span>
                  </div>
                  <p>{{ evento.observacion }}</p>
                </div>
              </div>
            </div>
          </article>
        </div>

        <aside class="actions-column">
          <article class="glass-card action-box payment-box">
            <h3>Pago del cliente</h3>
            <p class="subtle" *ngIf="latestPayment() as latest">
              Estado actual {{ latest.estado }} por {{ latest.monto_total | currency }} mediante {{ latest.metodo_pago }}.
            </p>
            <p class="subtle" *ngIf="!latestPayment()">
              El flujo permite registrar una intención de pago o confirmar el pago usando el monto estimado.
            </p>
            <ng-container *ngIf="canManagePayment(); else paymentReadOnly">
              <div class="form-group">
                <label>Método de pago</label>
                <select [(ngModel)]="paymentMethod" class="modern-select">
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="billetera">Billetera digital</option>
                </select>
              </div>
              <div class="form-group">
                <label>Monto</label>
                <input [(ngModel)]="paymentAmount" type="number" min="0" step="0.01" class="modern-select" />
              </div>
              <div class="form-group">
                <label>Referencia</label>
                <input [(ngModel)]="paymentReference" class="modern-select" />
              </div>
              <textarea [(ngModel)]="paymentNote" rows="3" class="modern-area" placeholder="Detalle del pago"></textarea>
              <div class="button-row">
                <button class="btn-dark" (click)="submitPayment(false)">Registrar</button>
                <button class="btn-success" (click)="submitPayment(true)">Confirmar pago</button>
              </div>
            </ng-container>
            <ng-template #paymentReadOnly>
              <p class="subtle">La gestión del pago para clientes se realiza desde la app móvil. Aquí queda visible el estado.</p>
            </ng-template>
          </article>

          <article class="glass-card tracking-card" *ngIf="seguimiento() as track">
            <div class="live-tag" [attr.data-live]="track.tracking_activo">TRACK</div>
            <h3>Seguimiento</h3>
            <div class="eta-box">
              <span class="eta-value">{{ track.eta_min ?? '--' }}</span>
              <span class="eta-label">ETA minutos</span>
            </div>
            <div class="track-details">
              <p><strong>Taller:</strong> {{ track.taller_nombre || 'Pendiente' }}</p>
              <p><strong>Técnico:</strong> {{ track.tecnico_nombre || 'Pendiente' }}</p>
              <p><strong>Distancia:</strong> {{ track.distancia_km ?? '--' }} km</p>
            </div>
            <div class="signal-row">
              <span class="signal-pill" [class.warning]="track.ubicacion_desactualizada">Ubicación {{ track.ubicacion_desactualizada ? 'desactualizada' : 'vigente' }}</span>
              <span class="signal-pill" *ngIf="track.requiere_compartir_ubicacion">Sin GPS</span>
              <span class="signal-pill" *ngIf="track.propuesta_expirada">Propuesta expirada</span>
            </div>
            <p class="tracking-message" *ngIf="track.mensaje">{{ track.mensaje }}</p>
            <small class="update-time" *ngIf="track.ubicacion_actualizada_en">
              Actualizado {{ track.ubicacion_actualizada_en | date: 'short' }}
            </small>
          </article>

          <article class="glass-card action-box" *ngIf="isClientApprovalPending()">
            <h3>Aprobación del cliente</h3>
            <p class="subtle">El cliente debe aceptar o rechazar el taller sugerido antes de continuar con taller y técnico.</p>
            <textarea [(ngModel)]="clientNote" rows="3" class="modern-area" placeholder="Observación para aprobar o rechazar"></textarea>
            <div class="button-row">
              <button class="btn-success" (click)="respondClientProposal(true)">Aprobar</button>
              <button class="btn-danger" (click)="respondClientProposal(false)">Rechazar</button>
            </div>
          </article>

          <article class="glass-card action-box" *ngIf="canAssign() && candidatos() as cand">
            <div class="card-header">
              <h3>Asignación inteligente</h3>
            </div>
            <p class="subtle" *ngIf="cand.mensaje">{{ cand.mensaje }}</p>
            <div class="candidate-list" *ngIf="cand.talleres.length">
              <div class="candidate-card" *ngFor="let t of cand.talleres.slice(0, 3)">
                <strong>{{ t.nombre }}</strong>
                <small>{{ t.distancia_km ?? '--' }} km · score {{ t.score ?? '--' }}</small>
                <small>{{ t.motivo_sugerencia || 'Cercanía y disponibilidad' }}</small>
              </div>
            </div>
            <div class="form-group">
              <label>Taller sugerido</label>
              <select [(ngModel)]="selectedWorkshopId" class="modern-select">
                <option [ngValue]="null">Seleccionar taller</option>
                <option *ngFor="let t of cand.talleres" [ngValue]="t.id">
                  {{ t.nombre }} · {{ t.distancia_km ?? '--' }} km
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>Técnico sugerido</label>
              <select [(ngModel)]="selectedTechnicianId" class="modern-select">
                <option [ngValue]="null">Auto / pendiente</option>
                <option *ngFor="let tec of cand.tecnicos" [ngValue]="tec.id">
                  {{ tec.nombre }} · ETA {{ tec.eta_min ?? '--' }}m
                </option>
              </select>
            </div>
            <button class="btn-primary full" (click)="assign()">Proponer asignación</button>
          </article>

          <article class="glass-card action-box" *ngIf="canRespondAssignment() || canRespondWorkshopAssignment()">
            <h3>Responder asignación</h3>
            <textarea [(ngModel)]="assignmentNote" rows="3" class="modern-area" placeholder="Escribe una nota"></textarea>
            <div class="button-row">
              <button class="btn-success" (click)="canRespondAssignment() ? respondAssignment(true) : respondWorkshopAssignment(true)">Aceptar</button>
              <button class="btn-danger" (click)="canRespondAssignment() ? respondAssignment(false) : respondWorkshopAssignment(false)">Rechazar</button>
            </div>
          </article>

          <article class="glass-card action-box" *ngIf="canReviewManually()">
            <h3>Revisión manual</h3>
            <textarea [(ngModel)]="manualSummary" class="modern-area" placeholder="Resumen validado"></textarea>
            <div class="form-group">
              <label>Prioridad final</label>
              <select [(ngModel)]="manualPriority" class="modern-select">
                <option value="BAJA">BAJA</option>
                <option value="MEDIA">MEDIA</option>
                <option value="ALTA">ALTA</option>
                <option value="CRITICA">CRITICA</option>
              </select>
            </div>
            <button class="btn-dark full" (click)="reviewManually()">Cerrar revisión</button>
          </article>

          <article class="glass-card action-box" *ngIf="canChangeTo('EN_ATENCION') || canChangeTo('COMPLETADA')">
            <h3>Actualizar progreso</h3>
            <textarea [(ngModel)]="statusNote" class="modern-area" placeholder="Notas de avance"></textarea>
            <div class="button-row">
              <button class="btn-dark" *ngIf="canChangeTo('EN_ATENCION')" (click)="changeStatus('EN_ATENCION')">En atención</button>
              <button class="btn-success" *ngIf="canChangeTo('COMPLETADA')" (click)="changeStatus('COMPLETADA')">Completar</button>
            </div>
          </article>

          <article class="glass-card action-box" *ngIf="canCancel()">
            <h3>Cancelar solicitud</h3>
            <textarea [(ngModel)]="cancelNote" class="modern-area" placeholder="Motivo de cancelación"></textarea>
            <button class="btn-danger-ghost full" (click)="cancel()">Cancelar</button>
          </article>
        </aside>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --success: #15803d; --danger: #b91c1c; --dark: #0f172a; --bg: #f1f5f9; }
    .detail-container { padding: 1.5rem; background: var(--bg); min-height: 100vh; }
    .detail-header { margin-bottom: 2rem; }
    .btn-back { text-decoration: none; color: var(--primary); font-weight: 700; }
    .header-main { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 1rem; }
    .title-info { display: flex; gap: 1rem; align-items: center; }
    h1, h3 { margin: 0; color: var(--dark); }
    .main-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 1.5rem; }
    .glass-card { background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .info-item.full { grid-column: 1 / -1; }
    .info-item label { display: block; font-size: 0.75rem; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 0.25rem; }
    .info-item p { margin: 0; color: #334155; line-height: 1.5; }
    code { background: #eff6ff; padding: 0.35rem 0.5rem; border-radius: 8px; }
    .ia-insight, .estimate-card { background: linear-gradient(135deg, #ffffff, #f5f3ff); }
    .ia-metrics, .tag-list, .signal-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; }
    .metric-pill, .tag, .signal-pill, .badge-status, .priority-tag { padding: 0.35rem 0.7rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
    .metric-pill, .tag, .signal-pill, .badge-status { background: #e2e8f0; color: #334155; }
    .metric-pill.warning, .signal-pill.warning { background: #fef3c7; color: #92400e; }
    .tag-success { background: #dcfce7; color: #166534; }
    .priority-tag[data-priority="CRITICA"] { background: #fee2e2; color: #b91c1c; }
    .priority-tag[data-priority="ALTA"] { background: #ffedd5; color: #c2410c; }
    .badge-status[data-status="ASIGNADA"] { background: #dbeafe; color: #1d4ed8; }
    .badge-status[data-status="EN_CAMINO"] { background: #dbeafe; color: #1e40af; }
    .badge-status[data-status="EN_ATENCION"] { background: #fef3c7; color: #92400e; }
    .resumen { color: #4c1d95; font-weight: 600; }
    .estimate-main { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem; }
    .estimate-main strong { font-size: 2rem; color: #4c1d95; }
    .subtle { color: #64748b; margin: 0.4rem 0 0; line-height: 1.5; }
    .alert-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 0.8rem; }
    .alert-box p { margin: 0.35rem 0 0; }
    .stack-list { display: grid; gap: 0.8rem; }
    .stack-list li, .candidate-card, .payment-item, .payment-summary { display: grid; gap: 0.25rem; }
    .payment-main { display: flex; justify-content: space-between; align-items: center; }
    .timeline { position: relative; padding-left: 1.25rem; border-left: 2px solid #e2e8f0; }
    .timeline-event { position: relative; margin-bottom: 1rem; }
    .event-dot { position: absolute; left: -1.65rem; top: 0.25rem; width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }
    .event-header { display: flex; justify-content: space-between; gap: 0.75rem; }
    .event-time, .update-time { color: #94a3b8; font-size: 0.8rem; }
    .tracking-card { background: var(--dark); color: white; }
    .tracking-card h3 { color: white; }
    .live-tag { position: absolute; right: 1.25rem; top: 1.25rem; background: #334155; color: white; }
    .live-tag[data-live="true"] { background: #ef4444; }
    .eta-box { text-align: center; padding: 1rem 0; }
    .eta-value { display: block; font-size: 3rem; font-weight: 800; }
    .eta-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; color: #cbd5e1; }
    .track-details p, .tracking-message { color: #e2e8f0; }
    .tracking-message { margin-top: 0.75rem; }
    .action-box h3 { margin-bottom: 0.75rem; }
    .candidate-list { display: grid; gap: 0.75rem; margin-bottom: 1rem; }
    .candidate-card { background: #f8fafc; border-radius: 12px; padding: 0.75rem; }
    .form-group { margin-bottom: 0.85rem; }
    .form-group label { display: block; color: #64748b; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem; }
    .modern-select, .modern-area { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; }
    .modern-area { resize: vertical; min-height: 90px; }
    .button-row { display: flex; gap: 0.75rem; }
    button { border: none; border-radius: 12px; padding: 0.8rem 1rem; font-weight: 700; cursor: pointer; }
    .btn-primary, .btn-dark, .btn-success, .btn-danger, .btn-danger-ghost { width: 100%; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-dark { background: var(--dark); color: white; }
    .btn-success { background: var(--success); color: white; }
    .btn-danger { background: var(--danger); color: white; }
    .btn-danger-ghost { background: transparent; color: var(--danger); border: 1px solid #fecaca; }
    @media (max-width: 1000px) { .main-grid { grid-template-columns: 1fr; } }
  `
})
export class SolicitudDetallePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(EmergencyApiService);
  private readonly authService = inject(AuthService);

  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly seguimiento = signal<SolicitudSeguimiento | null>(null);
  readonly candidatos = signal<SolicitudCandidatos | null>(null);
  readonly estados = signal<EstadoSolicitudOption[]>([]);
  readonly roleNames = computed(() => this.authService.currentRoles());
  readonly canAssign = computed(() => this.roleNames().some((role) => ['ADMINISTRADOR', 'OPERADOR'].includes(role)));

  selectedWorkshopId: number | null = null;
  selectedTechnicianId: number | null = null;
  assignmentNote = 'Confirmo disponibilidad operativa';
  workshopNote = 'El taller confirma cobertura';
  clientNote = 'Apruebo el taller sugerido para continuar';
  paymentMethod = 'tarjeta';
  paymentAmount: number | null = null;
  paymentReference = '';
  paymentNote = 'Registro de pago realizado por el cliente';
  statusNote = 'Actualización registrada desde la web';
  cancelNote = 'Cancelación solicitada por el usuario';
  manualSummary = 'Clasificación validada manualmente por operación';
  manualReason = 'Se ajustó la prioridad según revisión humana';
  manualPriority: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA' = 'MEDIA';

  constructor() {
    this.reload();
  }

  reload() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      return;
    }
    this.api.getSolicitudDetalle(id).subscribe((data) => {
      this.solicitud.set(data);
      if (!this.selectedWorkshopId && data.taller_id) {
        this.selectedWorkshopId = data.taller_id;
      }
      if (!this.selectedTechnicianId && data.tecnico_id) {
        this.selectedTechnicianId = data.tecnico_id;
      }
      if (this.paymentAmount === null && data.costo_estimado !== null && data.costo_estimado !== undefined) {
        this.paymentAmount = data.costo_estimado;
      }
    });
    this.api.getSeguimientoSolicitud(id).subscribe((data) => this.seguimiento.set(data));
    this.api.getEstadosSolicitud().subscribe((data) => this.estados.set(data));
    if (this.canAssign()) {
      this.api.getCandidatosSolicitud(id).subscribe((data) => this.candidatos.set(data));
    }
  }

  aiTags(): string[] {
    return this.solicitud()?.etiquetas_ia?.split('|').filter(Boolean) ?? [];
  }

  approvalLabel(value: boolean | null | undefined): string {
    if (value === true) {
      return 'Aprobada';
    }
    if (value === false) {
      return 'Pendiente';
    }
    return 'Sin respuesta';
  }

  showAiBlock(): boolean {
    const current = this.solicitud();
    return Boolean(
      current?.resumen_ia ||
      current?.transcripcion_audio ||
      current?.motivo_prioridad ||
      current?.etiquetas_ia ||
      current?.requiere_revision_manual
    );
  }

  hasEstimatedCost(): boolean {
    return this.solicitud()?.costo_estimado !== null && this.solicitud()?.costo_estimado !== undefined;
  }

  latestPayment() {
    return this.solicitud()?.pagos?.[0] ?? null;
  }

  isClientApprovalPending(): boolean {
    const current = this.solicitud();
    return this.roleNames().includes('CLIENTE') && current?.estado?.nombre === 'ASIGNADA' && current.cliente_aprobada === false;
  }

  canManagePayment(): boolean {
    const current = this.solicitud();
    const currentState = current?.estado?.nombre;
    return Boolean(
      this.roleNames().includes('CLIENTE') &&
      currentState &&
      ['ASIGNADA', 'EN_CAMINO', 'EN_ATENCION', 'COMPLETADA'].includes(currentState) &&
      currentState !== 'CANCELADA' &&
      current?.cliente_aprobada !== false
    );
  }

  assign() {
    const current = this.solicitud();
    if (!current || (!this.selectedWorkshopId && !this.selectedTechnicianId)) {
      return;
    }
    this.api.asignarTecnico(current.id, this.selectedTechnicianId, this.selectedWorkshopId).subscribe(() => this.reload());
  }

  respondClientProposal(approved: boolean) {
    const current = this.solicitud();
    if (current && this.clientNote.trim().length >= 3) {
      this.api.responderPropuestaCliente(current.id, approved, this.clientNote.trim()).subscribe(() => this.reload());
    }
  }

  respondAssignment(accepted: boolean) {
    const current = this.solicitud();
    if (current && this.assignmentNote.trim().length >= 3) {
      this.api.responderAsignacion(current.id, accepted, this.assignmentNote.trim()).subscribe(() => this.reload());
    }
  }

  respondWorkshopAssignment(accepted: boolean) {
    const current = this.solicitud();
    if (current && this.workshopNote.trim().length >= 3) {
      this.api.responderAsignacionTaller(current.id, accepted, this.workshopNote.trim()).subscribe(() => this.reload());
    }
  }

  changeStatus(target: string) {
    const current = this.solicitud();
    const stateId = this.estados().find((item) => item.nombre === target)?.id;
    if (current && stateId && this.statusNote.trim().length >= 3) {
      this.api.actualizarEstado(current.id, stateId, this.statusNote.trim()).subscribe(() => this.reload());
    }
  }

  cancel() {
    const current = this.solicitud();
    if (current && this.cancelNote.trim().length >= 3) {
      this.api.cancelarSolicitud(current.id, this.cancelNote.trim()).subscribe(() => this.reload());
    }
  }

  reviewManually() {
    const current = this.solicitud();
    if (current && this.manualSummary.trim().length >= 5) {
      this.api.revisarManual(
        current.id,
        current.clasificacion_confianza ?? 0.8,
        this.manualPriority,
        this.manualSummary.trim(),
        this.manualReason.trim()
      ).subscribe(() => this.reload());
    }
  }

  submitPayment(confirmarPago: boolean) {
    const current = this.solicitud();
    const monto = this.paymentAmount ?? current?.costo_estimado ?? null;
    if (!current || !monto || monto <= 0) {
      return;
    }
    this.api.registrarPagoSolicitud(current.id, {
      monto_total: monto,
      metodo_pago: this.paymentMethod,
      referencia_externa: this.paymentReference.trim() || null,
      observacion: this.paymentNote.trim() || null,
      confirmar_pago: confirmarPago
    }).subscribe(() => this.reload());
  }

  canRespondAssignment(): boolean {
    const current = this.solicitud();
    return this.roleNames().includes('TECNICO') && current?.estado?.nombre === 'ASIGNADA' && current.cliente_aprobada === true;
  }

  canRespondWorkshopAssignment(): boolean {
    const current = this.solicitud();
    return this.roleNames().includes('TALLER') && current?.estado?.nombre === 'ASIGNADA' && current.cliente_aprobada === true;
  }

  canReviewManually(): boolean {
    return Boolean(this.solicitud()?.requiere_revision_manual) && this.roleNames().some((role) => ['ADMINISTRADOR', 'OPERADOR'].includes(role));
  }

  canChangeTo(target: string): boolean {
    const currentState = this.solicitud()?.estado?.nombre;
    if (!currentState) {
      return false;
    }
    const canOperate = this.roleNames().some((role) => ['ADMINISTRADOR', 'OPERADOR', 'TECNICO'].includes(role));
    return canOperate && ((currentState === 'EN_CAMINO' && target === 'EN_ATENCION') || (currentState === 'EN_ATENCION' && target === 'COMPLETADA'));
  }

  canCancel(): boolean {
    const currentState = this.solicitud()?.estado?.nombre;
    if (!currentState || ['COMPLETADA', 'CANCELADA'].includes(currentState)) {
      return false;
    }
    const roles = this.roleNames();
    return roles.includes('ADMINISTRADOR') || roles.includes('OPERADOR') || (roles.includes('CLIENTE') && currentState !== 'EN_ATENCION');
  }
}

export {};
