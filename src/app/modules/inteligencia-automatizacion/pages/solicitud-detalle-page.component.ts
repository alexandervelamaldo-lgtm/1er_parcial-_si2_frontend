import { CommonModule, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  Evidencia,
  EstadoSolicitudOption,
  SolicitudCandidatos,
  SolicitudDetalle,
  SolicitudSeguimiento,
  TrabajoFinalizadoPayload
} from '../../../core/models/gestion-solicitudes/api.models';
import { AuthService } from '../../../core/services/autenticacion-acceso/auth.service';
import { EmergencyApiService } from '../../../core/services/gestion-solicitudes/emergency-api.service';
import { TrackingService } from '../../../core/services/tracking/tracking.service';
import { canProposeWorkshopAssignment, normalizeSolicitudState } from '../../../core/utils/solicitud-assign';
import { environment } from '../../../../environments/environment';
import { ServicioTrackingMapComponent } from '../../../shared/components/servicio-tracking-map/servicio-tracking-map.component';
import { SolicitudChatPanelComponent } from '../../gestion-solicitudes/components/solicitud-chat-panel.component';

@Component({
  selector: 'app-solicitud-detalle-page',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink, ServicioTrackingMapComponent, SolicitudChatPanelComponent],
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
              <span class="confidence-chip"
                    [class.high]="solicitud.costo_estimacion_confianza >= 0.8"
                    [class.mid]="solicitud.costo_estimacion_confianza >= 0.5 && solicitud.costo_estimacion_confianza < 0.8"
                    [class.low]="solicitud.costo_estimacion_confianza < 0.5"
                    *ngIf="solicitud.costo_estimacion_confianza !== null && solicitud.costo_estimacion_confianza !== undefined">
                <span class="conf-dot"></span>
                Confianza {{ (solicitud.costo_estimacion_confianza * 100) | number: '1.0-0' }}%
              </span>
            </div>
            <ng-container *ngIf="hasEstimatedCost(); else noEstimate">
              <!-- Costo principal: número grande con etiqueta clara -->
              <div class="estimate-hero">
                <div class="hero-amount">
                  <span class="currency">Bs</span>
                  <strong>{{ formatBsCompact(solicitud.costo_estimado) }}</strong>
                </div>
                <span class="hero-tag">estimación referencial</span>
              </div>

              <!-- Barra de rango visual: min ── prob ── max -->
              <div class="range-visual"
                   *ngIf="solicitud.costo_estimado_min !== null && solicitud.costo_estimado_max !== null">
                <div class="range-track">
                  <div class="range-fill"></div>
                  <div class="range-marker"
                       [style.left.%]="rangeMarkerPosition()"
                       [attr.title]="'Más probable: ' + formatBs(solicitud.costo_estimado)">
                  </div>
                </div>
                <div class="range-labels">
                  <span>{{ formatBs(solicitud.costo_estimado_min) }}</span>
                  <span class="range-mid">{{ formatBs(solicitud.costo_estimado) }} <small>más probable</small></span>
                  <span>{{ formatBs(solicitud.costo_estimado_max) }}</span>
                </div>
              </div>

              <!-- Factores aplicados — parseamos la nota técnica en chips
                   visuales con iconos. Mucho más útil que el párrafo de
                   "f_antiguedad=1.0 f_complejidad=0.92…" -->
              <div class="factors-grid" *ngIf="costFactors().length > 0">
                <div class="factor-chip" *ngFor="let f of costFactors()">
                  <span class="factor-icon" [class]="'icon-' + f.icon">{{ f.iconText }}</span>
                  <div class="factor-body">
                    <span class="factor-label">{{ f.label }}</span>
                    <span class="factor-value">{{ f.value }}</span>
                  </div>
                </div>
              </div>

              <!-- Detalles técnicos (auditoría) — colapsado por defecto.
                   Las/os operadores pueden ver el cálculo completo si
                   necesitan investigar una estimación dudosa. -->
              <details class="tech-details" *ngIf="solicitud.costo_estimacion_nota">
                <summary>Ver detalles técnicos del cálculo</summary>
                <pre>{{ solicitud.costo_estimacion_nota }}</pre>
              </details>

              <!-- Bloque de aporte de imágenes — visual sin clutter -->
              <div class="visual-block" *ngIf="solicitud.visual_summary || (solicitud.visual_tags && solicitud.visual_tags.length)">
                <div class="visual-block-head">
                  <span class="metric-pill visual-pill">📷 Aporte de imágenes</span>
                  <span class="muted"
                        *ngIf="solicitud.visual_confidence !== null && solicitud.visual_confidence !== undefined">
                    {{ (solicitud.visual_confidence * 100) | number: '1.0-0' }}% confianza
                    <span *ngIf="solicitud.visual_factor !== null && solicitud.visual_factor !== undefined">
                      · factor ×{{ solicitud.visual_factor | number: '1.2-2' }}
                    </span>
                  </span>
                </div>
                <p class="subtle visual-summary" *ngIf="solicitud.visual_summary">{{ solicitud.visual_summary }}</p>
                <div class="tag-list" *ngIf="solicitud.visual_tags && solicitud.visual_tags.length">
                  <span class="tag" *ngFor="let visualTag of solicitud.visual_tags">{{ visualTag }}</span>
                </div>
              </div>

              <!-- Banners de revisión manual — solo cuando aplica -->
              <div class="alert-box estimate-warning"
                   *ngIf="solicitud.costo_estimacion_confianza !== null && solicitud.costo_estimacion_confianza !== undefined && solicitud.costo_estimacion_confianza < 0.65">
                <strong>⚠ Revisión manual sugerida</strong>
                <p>La confianza de la estimación es baja para cierre automático.</p>
              </div>
              <div class="alert-box estimate-warning"
                   *ngIf="solicitud.visual_confidence !== null && solicitud.visual_confidence !== undefined && solicitud.visual_confidence < 0.65">
                <strong>⚠ Revisión manual sugerida</strong>
                <p>La evidencia visual tiene baja confianza y debe validarse manualmente.</p>
              </div>
            </ng-container>
            <ng-template #noEstimate>
              <p class="subtle">La estimación aún no está disponible para esta solicitud.</p>
            </ng-template>
          </article>

          <article class="glass-card estimate-card" *ngIf="hasFinalCost()">
            <div class="card-header">
              <h3>Cierre del taller</h3>
              <span class="metric-pill tag-success" *ngIf="solicitud.trabajo_terminado">Trabajo realizado</span>
            </div>
            <div class="estimate-main">
              <strong>{{ formatBs(solicitud.costo_final) }}</strong>
              <span>costo final en Bs</span>
            </div>
            <p class="subtle" *ngIf="solicitud.trabajo_terminado_en">
              Registrado {{ solicitud.trabajo_terminado_en | date: 'medium' }}
            </p>
            <p class="subtle" *ngIf="solicitud.trabajo_terminado_observacion">{{ solicitud.trabajo_terminado_observacion }}</p>
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
            <div class="alert-box audio-status pending" *ngIf="solicitud.transcripcion_audio_estado === 'PROCESANDO'">
              <strong>Transcripción de audio en proceso</strong>
              <p>Estamos procesando la nota de voz. Recarga la solicitud en unos segundos.</p>
            </div>
            <div class="alert-box audio-status error" *ngIf="solicitud.transcripcion_audio_estado === 'ERROR'">
              <strong>No se pudo transcribir el audio</strong>
              <p>{{ solicitud.transcripcion_audio_error || 'Error interno de transcripción.' }}</p>
            </div>
          </article>

          <article class="glass-card" *ngIf="solicitud.evidencias.length">
            <div class="card-header">
              <h3>Evidencias</h3>
            </div>
            <ul class="evidence-list">
              <li class="evidence-row" *ngFor="let ev of solicitud.evidencias">
                <div class="evidence-type">{{ ev.tipo }}</div>
                <div class="evidence-body" [ngSwitch]="ev.tipo">
                  <span *ngSwitchCase="'TEXT'">{{ ev.contenido_texto }}</span>

                  <ng-container *ngSwitchCase="'IMAGE'">
                    <div class="evidence-media">
                      <button
                        type="button"
                        class="thumb-button"
                        (click)="openEvidence(ev)"
                        [disabled]="evidenceFailed(ev.id)"
                        aria-label="Ver imagen adjunta"
                      >
                        <img
                          class="thumb"
                          [src]="buildEvidenceUrl(ev)"
                          [alt]="ev.nombre_archivo || 'Evidencia'"
                          (error)="markEvidenceError(ev.id)"
                        />
                      </button>
                      <div class="evidence-actions">
                        <strong>{{ ev.nombre_archivo || 'Imagen adjunta' }}</strong>
                        <button type="button" class="btn-link" (click)="openEvidence(ev)" [disabled]="evidenceFailed(ev.id)">
                          Ver completa
                        </button>
                        <a class="btn-link" [href]="buildEvidenceUrl(ev)" target="_blank" rel="noopener">Abrir</a>
                        <span class="evidence-error" *ngIf="evidenceFailed(ev.id)">No se pudo cargar la imagen.</span>
                      </div>
                    </div>
                  </ng-container>

                  <ng-container *ngSwitchCase="'AUDIO'">
                    <div class="evidence-actions">
                      <strong>{{ ev.nombre_archivo || 'Audio adjunto' }}</strong>
                      <a class="btn-link" [href]="buildEvidenceUrl(ev)" target="_blank" rel="noopener">Descargar / reproducir</a>
                    </div>
                  </ng-container>

                  <ng-container *ngSwitchDefault>
                    <span>{{ ev.nombre_archivo || ev.contenido_texto || 'Archivo adjunto' }}</span>
                  </ng-container>
                </div>
              </li>
            </ul>
          </article>

          <article class="glass-card">
            <div class="card-header">
              <h3>Pagos y comisión</h3>
            </div>
            <div class="payment-summary" *ngIf="latestPayment() as latest; else noPayment">
              <div class="payment-main">
                <strong>{{ formatBs(latest.monto_total) }}</strong>
                <span class="tag" [class.tag-success]="latest.estado === 'PAGADO'">{{ latest.estado }}</span>
              </div>
              <p class="subtle">
                Método {{ latest.metodo_pago }} · Taller {{ formatBs(latest.monto_taller) }} · Comisión {{ formatBs(latest.monto_comision) }}
              </p>
              <p class="subtle" *ngIf="latest.referencia_externa">Referencia {{ latest.referencia_externa }}</p>
            </div>
            <ng-template #noPayment>
              <p class="subtle">Todavía no hay pagos registrados para esta solicitud.</p>
            </ng-template>
            <div class="payment-item" *ngFor="let pago of solicitud.pagos">
              <div class="payment-main">
                <strong>{{ formatBs(pago.monto_total) }}</strong>
                <span class="tag" [class.tag-success]="pago.estado === 'PAGADO'">{{ pago.estado }}</span>
              </div>
              <small>{{ pago.metodo_pago }} · Taller {{ formatBs(pago.monto_taller) }} · Comisión {{ formatBs(pago.monto_comision) }}</small>
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
              Estado actual {{ latest.estado }} por {{ formatBs(latest.monto_total) }} mediante {{ latest.metodo_pago }}.
            </p>
            <p class="subtle" *ngIf="!latestPayment()">
              El pago final queda habilitado cuando el taller registra el trabajo realizado y el costo final en Bs.
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
                <label>Monto final en Bs</label>
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
              <p class="subtle">El pago del cliente se confirma desde la app móvil. Aquí queda visible el estado y la factura final.</p>
            </ng-template>
          </article>

          <article class="glass-card action-box" *ngIf="canDownloadInvoice()">
            <h3>Factura PDF</h3>
            <p class="subtle">Cliente, operador y administrador pueden descargar el comprobante del servicio ya pagado.</p>
            <button class="btn-primary full" (click)="openInvoice()">Descargar factura</button>
          </article>

          <article class="glass-card tracking-card" *ngIf="seguimiento() as track">
            <div class="live-tag" [attr.data-live]="track.tracking_activo">TRACK</div>
            <h3>Seguimiento</h3>
            <div class="eta-box">
              <span class="eta-value">{{ displayEtaMin() ?? '--' }}</span>
              <span class="eta-label">ETA minutos</span>
            </div>
            <div class="track-details">
              <p><strong>Servicio:</strong> {{ track.servicio_estado || 'BUSCANDO' }}</p>
              <p><strong>Taller:</strong> {{ track.taller_nombre || 'Pendiente' }}</p>
              <p><strong>Profesional:</strong> {{ track.tecnico_nombre || 'Pendiente' }}</p>
              <p><strong>Distancia:</strong> {{ displayDistanceKm() ?? '--' }} km</p>
              <p><strong>Ubicación final:</strong> {{ track.confirmacion_ubicacion_ok ? 'Validada' : 'Pendiente' }}</p>
            </div>
            <div class="signal-row">
              <span class="signal-pill" [class.warning]="track.ubicacion_desactualizada">Ubicación {{ track.ubicacion_desactualizada ? 'desactualizada' : 'vigente' }}</span>
              <span class="signal-pill" *ngIf="track.requiere_compartir_ubicacion">Sin GPS</span>
              <span class="signal-pill" *ngIf="track.propuesta_expirada">Propuesta expirada</span>
              <span class="signal-pill" *ngIf="track.match_especialidad">Especialidad compatible</span>
            </div>
            <p class="tracking-message" *ngIf="track.mensaje">{{ track.mensaje }}</p>
            <small class="update-time" *ngIf="track.ubicacion_actualizada_en">
              Actualizado {{ track.ubicacion_actualizada_en | date: 'short' }}
            </small>
            <app-servicio-tracking-map
              [clientLocation]="trackingClientLocation()"
              [serviceLocation]="trackingServiceLocation()"
              [professionalLocation]="trackingProfessionalLocation()"
              [workshopLocation]="trackingWorkshopLocation()"
              [workshopName]="track.taller_nombre || null"
              [professionalName]="track.tecnico_nombre || null"
              [etaMin]="displayEtaMin()"
              [updatedAt]="track.ubicacion_actualizada_en ?? null"
              [routeColor]="trackingRouteColor()"
              [trackingEnabled]="shouldRenderTrackingRoute()"
              [serverWorkshopRoute]="serverWorkshopRoute()"
              (routeMetrics)="onRouteMetricsChange($event)"
            />
          </article>

          <!-- Chat en vivo cliente ↔ (taller o técnico asignado). Solo se
               monta si el usuario logueado es participante válido y hay
               contraparte; el backend además re-valida cada request. -->
          <app-solicitud-chat-panel
            *ngIf="chatRole() as rol"
            [solicitudId]="solicitud.id"
            [miRol]="rol"
            [hayTecnicoAsignado]="chatHasTecnico()"
            [disabled]="isChatDisabled() || !chatHasContraparte()"
            [disabledReasonText]="!chatHasContraparte()
              ? 'Aún no hay taller ni técnico asignado a esta solicitud.'
              : 'Esta solicitud ya no está activa. Solo se muestra el historial.'"
          />

          <article class="glass-card action-box" *ngIf="canSimulateDispatch()">
            <h3>Despachar equipo del taller</h3>
            <p class="subtle">Este taller no tiene técnico asignado. Simula la salida del taller hacia el incidente; al llegar, la solicitud pasa a <strong>En atención</strong>.</p>
            <p class="action-feedback" *ngIf="feedback()">{{ feedback() }}</p>
            <button class="btn-primary full" (click)="simulateDispatch()" [disabled]="simulating()">
              {{ simulating() ? 'En camino al incidente…' : 'Simular salida al incidente' }}
            </button>
          </article>

          <article class="glass-card action-box" *ngIf="isClientApprovalPending()">
            <h3>Aprobación del cliente</h3>
            <p class="subtle">El cliente debe aceptar o rechazar el taller sugerido antes de continuar con el taller asignado.</p>
            <textarea [(ngModel)]="clientNote" rows="3" class="modern-area" placeholder="Observación para aprobar o rechazar"></textarea>
            <div class="button-row">
              <button class="btn-success" (click)="respondClientProposal(true)">Aprobar</button>
              <button class="btn-danger" (click)="respondClientProposal(false)">Rechazar</button>
            </div>
          </article>

          <!-- Toggle "Modo emergencia": el operador asume el control manual. -->
          <article class="glass-card action-box" *ngIf="canAssign()">
            <div class="card-header" style="display: flex; align-items: center; justify-content: space-between;">
              <div>
                <h3 style="margin: 0;">🛟 Modo emergencia</h3>
                <p class="subtle" style="margin: 4px 0 0; font-size: 0.85rem;">
                  Solo úsalo si el flujo cliente↔taller-directo no funciona (taller no responde, rechazos consecutivos).
                </p>
              </div>
              <button
                type="button"
                class="btn-warning"
                style="white-space: nowrap;"
                (click)="emergencyMode.set(!emergencyMode())">
                {{ emergencyMode() ? 'Salir del modo' : 'Activar' }}
              </button>
            </div>
          </article>

          <article
            class="glass-card action-box"
            *ngIf="emergencyMode() && canProposeAssignment() && candidatos() as cand"
            style="border-left: 4px solid #f59e0b;">
            <div class="card-header">
              <h3>⚠️ Asignación manual (Modo emergencia)</h3>
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
              <label>Taller sugerido</label>
              <select [(ngModel)]="selectedTechnicianId" class="modern-select">
                <option [ngValue]="null">Auto / pendiente</option>
                <option *ngFor="let tec of cand.tecnicos" [ngValue]="tec.id">
                  {{ tec.nombre }} · ETA {{ tec.eta_min ?? '--' }}m · Cobertura {{ tec.radio_cobertura_km ?? '--' }} km
                </option>
              </select>
            </div>
            <button class="btn-primary full" (click)="assign()">Proponer asignación</button>
          </article>

          <article class="glass-card action-box" *ngIf="canRespondAssignment() || canRespondWorkshopAssignment()">
            <h3>Responder asignación</h3>
            <textarea [(ngModel)]="assignmentNote" rows="3" class="modern-area" placeholder="Escribe una nota"></textarea>
            <p class="action-feedback" *ngIf="feedback()">{{ feedback() }}</p>
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

          <article class="glass-card action-box" *ngIf="canChangeTo('EN_ATENCION')">
            <h3>Actualizar progreso</h3>
            <textarea [(ngModel)]="statusNote" class="modern-area" placeholder="Notas de avance"></textarea>
            <div class="button-row">
              <button class="btn-dark" *ngIf="canChangeTo('EN_ATENCION')" (click)="changeStatus('EN_ATENCION')">En atención</button>
            </div>
          </article>

          <article class="glass-card action-box" *ngIf="canFinalizeTechnicalWork()">
            <h3>Trabajo realizado</h3>
            <p class="subtle" *ngIf="solicitud.tecnico_id">El técnico registra el costo final real y confirma su ubicación actual. El cierre se bloquea si el GPS no coincide con el punto del servicio.</p>
            <p class="subtle" *ngIf="!solicitud.tecnico_id">El taller registra el costo final real del servicio. Tras cerrar, el cliente podrá pagar desde su app.</p>
            <div class="form-group">
              <label>Costo final en Bs</label>
              <input [(ngModel)]="finalCostAmount" type="number" min="0" step="0.01" class="modern-select" />
            </div>
            <textarea [(ngModel)]="finalizationNote" class="modern-area" placeholder="Resumen del trabajo realizado"></textarea>
            <button class="btn-success full" (click)="submitTechnicalClosure()">Registrar trabajo hecho</button>
          </article>

          <article class="glass-card action-box" *ngIf="canCancel()">
            <h3>Cancelar solicitud</h3>
            <textarea [(ngModel)]="cancelNote" class="modern-area" placeholder="Motivo de cancelación"></textarea>
            <button class="btn-danger-ghost full" (click)="cancel()">Cancelar</button>
          </article>
        </aside>
      </div>
    </section>

    <div class="modal-overlay" *ngIf="selectedEvidence() as selected" (click)="closeEvidence()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">{{ selected.nombre_archivo || 'Evidencia' }}</div>
          <button type="button" class="btn-ghost" (click)="closeEvidence()">Cerrar</button>
        </div>
        <img class="modal-image" [src]="buildEvidenceUrl(selected)" [alt]="selected.nombre_archivo || 'Evidencia'" />
        <div class="modal-buttons">
          <a class="btn-ghost" [href]="buildEvidenceUrl(selected)" target="_blank" rel="noopener">Abrir</a>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { --primary: #2563eb; --success: #15803d; --danger: #b91c1c; --dark: #0f172a; --bg: #f1f5f9; }
    .detail-container { padding: 1.5rem; background: var(--bg); min-height: 100vh; }
    .detail-header { margin-bottom: 2rem; }
    .btn-back { text-decoration: none; color: var(--primary); font-weight: 700; }
    .header-main { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; }
    .title-info { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
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
    .visual-block { margin-top: 0.6rem; padding: 0.75rem; border: 1px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; }
    .visual-pill { background: #e0e7ff; color: #3730a3; }
    .alert-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 0.8rem; }
    .alert-box p { margin: 0.35rem 0 0; }
    .estimate-warning { border-color: #fde68a; background: #fffbeb; margin-top: 0.75rem; }

    /* ── Costo estimado — diseño rediseñado ──────────────────────── */

    /* Chip de confianza con dot de color según nivel */
    .confidence-chip {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.35rem 0.75rem; border-radius: 999px;
      font-size: 0.78rem; font-weight: 600;
      background: #e2e8f0; color: #334155;
    }
    .confidence-chip .conf-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #94a3b8;
    }
    .confidence-chip.high { background: #dcfce7; color: #166534; }
    .confidence-chip.high .conf-dot { background: #16a34a; box-shadow: 0 0 0 3px #bbf7d033; }
    .confidence-chip.mid { background: #fef3c7; color: #92400e; }
    .confidence-chip.mid .conf-dot { background: #f59e0b; box-shadow: 0 0 0 3px #fde68a44; }
    .confidence-chip.low { background: #fee2e2; color: #991b1b; }
    .confidence-chip.low .conf-dot { background: #dc2626; box-shadow: 0 0 0 3px #fecaca44; }

    /* Hero: el número grande del costo */
    .estimate-hero {
      display: flex; align-items: baseline; gap: 0.8rem;
      margin: 0.5rem 0 1rem; padding: 1rem 1.2rem;
      background: linear-gradient(135deg, #faf5ff, #ede9fe);
      border-radius: 14px; border: 1px solid #ddd6fe;
    }
    .hero-amount { display: flex; align-items: baseline; gap: 0.4rem; }
    .hero-amount .currency {
      font-size: 1.2rem; font-weight: 700; color: #6d28d9;
      letter-spacing: -0.02em;
    }
    .hero-amount strong {
      font-size: 2.6rem; font-weight: 800; line-height: 1;
      color: #4c1d95; letter-spacing: -0.04em;
      font-variant-numeric: tabular-nums;
    }
    .hero-tag {
      font-size: 0.8rem; color: #7c3aed; font-weight: 500;
      text-transform: lowercase;
    }

    /* Barra de rango con marcador del "más probable" */
    .range-visual { margin: 0.5rem 0 1rem; }
    .range-track {
      position: relative; height: 8px; border-radius: 6px;
      background: linear-gradient(90deg, #e0e7ff, #c7d2fe, #a5b4fc);
      overflow: visible;
    }
    .range-fill {
      position: absolute; left: 0; right: 0; top: 0; bottom: 0;
      border-radius: 6px;
    }
    .range-marker {
      position: absolute; top: 50%; transform: translate(-50%, -50%);
      width: 18px; height: 18px; border-radius: 50%;
      background: #4c1d95; border: 3px solid #fff;
      box-shadow: 0 2px 6px rgba(76, 29, 149, 0.4);
      cursor: help;
    }
    .range-labels {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 0.6rem; font-size: 0.75rem; color: #64748b;
    }
    .range-labels .range-mid {
      color: #4c1d95; font-weight: 700;
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      flex: 1; text-align: center;
    }
    .range-labels .range-mid small {
      color: #94a3b8; font-weight: 500; font-size: 0.7rem;
      text-transform: lowercase;
    }

    /* Grilla de factores en chips visuales */
    .factors-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.6rem; margin: 1rem 0 0.75rem;
    }
    .factor-chip {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.6rem 0.8rem;
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 10px;
      transition: border-color 0.15s, transform 0.15s;
    }
    .factor-chip:hover { border-color: #c7d2fe; transform: translateY(-1px); }
    .factor-icon {
      font-size: 1.3rem; line-height: 1;
      width: 36px; height: 36px; border-radius: 8px;
      display: grid; place-items: center;
      background: #ede9fe; flex-shrink: 0;
    }
    .factor-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .factor-label {
      font-size: 0.7rem; color: #64748b; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.03em;
    }
    .factor-value {
      font-size: 0.85rem; color: #0f172a; font-weight: 600;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* Detalles técnicos colapsables */
    .tech-details {
      margin-top: 0.5rem;
      border-top: 1px dashed #e2e8f0; padding-top: 0.5rem;
    }
    .tech-details summary {
      cursor: pointer; font-size: 0.78rem; color: #6366f1;
      font-weight: 600; padding: 0.3rem 0;
      user-select: none;
    }
    .tech-details summary:hover { color: #4f46e5; }
    .tech-details[open] summary { margin-bottom: 0.4rem; }
    .tech-details pre {
      margin: 0; padding: 0.7rem;
      background: #0f172a; color: #cbd5e1;
      border-radius: 8px; font-size: 0.72rem; line-height: 1.5;
      white-space: pre-wrap; word-break: break-word;
      font-family: 'SF Mono', Monaco, Menlo, monospace;
    }

    /* Visual block — refinado */
    .visual-block-head {
      display: flex; align-items: center; justify-content: space-between;
      gap: 0.6rem; margin-bottom: 0.5rem; flex-wrap: wrap;
    }
    .visual-block-head .muted {
      font-size: 0.75rem; color: #64748b; font-weight: 500;
    }
    .visual-summary { margin-top: 0.3rem !important; font-size: 0.85rem; }
    .audio-status.pending { border-color: #fde68a; background: #fffbeb; }
    .audio-status.error { border-color: #fecaca; background: #fef2f2; }
    .stack-list { display: grid; gap: 0.8rem; }
    .stack-list li, .candidate-card, .payment-item, .payment-summary { display: grid; gap: 0.25rem; }
    .evidence-list { display: grid; gap: 0.9rem; margin: 0; padding: 0; list-style: none; }
    .evidence-row { display: grid; grid-template-columns: 90px 1fr; gap: 0.9rem; align-items: start; }
    .evidence-type { font-weight: 800; color: #0f172a; letter-spacing: 0.03em; }
    .evidence-body { color: #334155; line-height: 1.5; }
    .evidence-media { display: flex; gap: 0.9rem; flex-wrap: wrap; align-items: flex-start; }
    .thumb-button { border: none; background: transparent; padding: 0; cursor: pointer; }
    .thumb-button[disabled] { cursor: default; opacity: 0.6; }
    .thumb { width: 140px; height: 96px; object-fit: cover; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; }
    .evidence-actions { display: flex; flex-direction: column; gap: 0.35rem; }
    .btn-link { border: none; background: transparent; padding: 0; color: var(--primary); font-weight: 800; cursor: pointer; text-align: left; }
    .btn-link[disabled] { cursor: default; opacity: 0.6; }
    .evidence-error { color: #b91c1c; font-weight: 700; }
    .modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.72); display: grid; place-items: center; padding: 1.25rem; z-index: 10000; }
    .modal-card { width: min(980px, 100%); max-height: calc(100vh - 2.5rem); overflow: auto; background: white; border-radius: 18px; border: 1px solid #e2e8f0; padding: 1rem; box-shadow: 0 18px 56px rgba(15, 23, 42, 0.25); }
    .modal-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 0.9rem; }
    .modal-title { font-weight: 900; color: #0f172a; }
    .modal-image { width: 100%; height: auto; border-radius: 14px; border: 1px solid #e2e8f0; background: #f8fafc; }
    .modal-buttons { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.85rem; }
    .btn-ghost { border: 1px solid #cbd5e1; background: transparent; border-radius: 12px; padding: 0.65rem 0.9rem; font-weight: 800; cursor: pointer; color: #0f172a; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
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
    .action-feedback { margin: 0.5rem 0; padding: 0.6rem 0.8rem; border-radius: 10px; background: #eef2ff; color: #3730a3; font-weight: 600; font-size: 0.85rem; }
    .candidate-list { display: grid; gap: 0.75rem; margin-bottom: 1rem; }
    .candidate-card { background: #f8fafc; border-radius: 12px; padding: 0.75rem; }
    .form-group { margin-bottom: 0.85rem; }
    .form-group label { display: block; color: #64748b; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem; }
    .modern-select, .modern-area { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; }
    .modern-area { resize: vertical; min-height: 90px; }
    .button-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    button { border: none; border-radius: 12px; padding: 0.8rem 1rem; font-weight: 700; cursor: pointer; }
    .btn-primary, .btn-dark, .btn-success, .btn-danger, .btn-danger-ghost { width: 100%; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-dark { background: var(--dark); color: white; }
    .btn-success { background: var(--success); color: white; }
    .btn-danger { background: var(--danger); color: white; }
    .btn-danger-ghost { background: transparent; color: var(--danger); border: 1px solid #fecaca; }
    @media (max-width: 1000px) {
      .main-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 900px) {
      .detail-container { padding: 1rem; }
      .header-main { flex-direction: column; align-items: flex-start; }
      .priority-tag { align-self: flex-start; }
      .info-grid { grid-template-columns: 1fr; }
      .event-header { flex-direction: column; align-items: flex-start; }
      .payment-main { flex-direction: column; align-items: flex-start; gap: 0.35rem; }
      .timeline { padding-left: 1rem; }
      .event-dot { left: -1.45rem; }
    }

    @media (max-width: 640px) {
      .glass-card { padding: 1rem; border-radius: 16px; }
      .button-row { flex-direction: column; }
      button { width: 100%; }
      .estimate-main strong { font-size: 1.6rem; }
      code { display: inline-block; max-width: 100%; overflow: auto; }
    }
  `
})
export class SolicitudDetallePageComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(EmergencyApiService);
  private readonly authService = inject(AuthService);
  private readonly tracking = inject(TrackingService);

  readonly solicitud = signal<SolicitudDetalle | null>(null);
  readonly seguimiento = signal<SolicitudSeguimiento | null>(null);
  readonly candidatos = signal<SolicitudCandidatos | null>(null);
  readonly estados = signal<EstadoSolicitudOption[]>([]);
  /// Modo emergencia: por defecto el operador no asigna manualmente —
  /// el cliente elige taller desde la app y el taller acepta/rechaza.
  /// Solo cuando hace falta soporte (3+ rechazos, taller no responde,
  /// edge cases) el operador habilita este modo para asignar a mano.
  readonly emergencyMode = signal<boolean>(false);
  readonly selectedEvidence = signal<Evidencia | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly simulating = signal<boolean>(false);
  readonly liveRouteEtaMin = signal<number | null>(null);
  readonly liveRouteDistanceKm = signal<number | null>(null);
  @ViewChild(ServicioTrackingMapComponent) private trackingMap?: ServicioTrackingMapComponent;
  readonly roleNames = computed(() => this.authService.currentRoles());
  readonly canAssign = computed(() => this.roleNames().some((role) => ['ADMINISTRADOR', 'OPERADOR'].includes(role)));
  /** Rol que juega el usuario en el chat de la solicitud (null → no ve chat). */
  readonly chatRole = computed<'cliente' | 'tecnico' | 'taller' | null>(() => {
    const roles = this.roleNames();
    if (roles.includes('CLIENTE')) return 'cliente';
    if (roles.includes('TECNICO')) return 'tecnico';
    if (roles.includes('TALLER')) return 'taller';
    return null;
  });
  /** Hay técnico asignado (para elegir el label del header del chat). */
  readonly chatHasTecnico = computed<boolean>(() => (this.solicitud()?.tecnico_id ?? null) !== null);
  /** Hay contraparte con quien chatear (taller o técnico). */
  readonly chatHasContraparte = computed<boolean>(() => {
    const s = this.solicitud();
    return (s?.tecnico_id ?? null) !== null || (s?.taller_id ?? null) !== null;
  });
  /** El composer se apaga si la solicitud ya cerró — pero seguimos mostrando historial. */
  readonly isChatDisabled = computed<boolean>(() => {
    const nombre = (this.solicitud()?.estado?.nombre || '').toUpperCase();
    return ['CERRADA', 'FINALIZADA', 'COMPLETADA', 'CANCELADA'].includes(nombre);
  });
  readonly canProposeAssignment = computed(() => {
    if (!this.canAssign()) return false;
    const current = this.solicitud();
    if (!current) return false;
    return canProposeWorkshopAssignment({
      estadoNombre: current.estado?.nombre,
      tecnicoId: current.tecnico_id ?? null,
      clienteAprobada: current.cliente_aprobada ?? null
    });
  });
  readonly liveTechnician = computed(() => {
    const tecnicoId = this.seguimiento()?.tecnico_id;
    if (!tecnicoId) {
      return null;
    }
    return this.tracking.tecnicos().find((item) => item.id === tecnicoId) ?? null;
  });
  readonly trackingClientLocation = computed(() => {
    const current = this.seguimiento();
    if (current?.latitud_cliente == null || current?.longitud_cliente == null) {
      return null;
    }
    return { lat: current.latitud_cliente, lng: current.longitud_cliente };
  });
  readonly trackingServiceLocation = computed(() => {
    const current = this.seguimiento();
    if (current?.latitud_servicio != null && current?.longitud_servicio != null) {
      return { lat: current.latitud_servicio, lng: current.longitud_servicio };
    }
    const solicitud = this.solicitud();
    if (!solicitud) {
      return null;
    }
    return { lat: solicitud.latitud_incidente, lng: solicitud.longitud_incidente };
  });
  readonly trackingProfessionalLocation = computed(() => {
    const live = this.liveTechnician();
    if (live) {
      return { lat: live.lat, lng: live.lng };
    }
    const current = this.seguimiento();
    if (current?.latitud_actual == null || current?.longitud_actual == null) {
      return null;
    }
    return { lat: current.latitud_actual, lng: current.longitud_actual };
  });
  /// Workshop coordinates from the seguimiento payload. Used by the tracking
  /// map to draw the planned incident → workshop route as a secondary dashed
  /// line, so the operator and the cliente always see the full intended path
  /// (not just the live professional → service tramo).
  readonly trackingWorkshopLocation = computed(() => {
    const current = this.seguimiento();
    if (current?.latitud_taller == null || current?.longitud_taller == null) return null;
    return { lat: current.latitud_taller, lng: current.longitud_taller };
  });

  /// Ruta servicio→taller pre-calculada por el backend (Mapbox Directions).
  /// La pasamos directamente al componente del mapa para que no tenga que
  /// re-calcular en el cliente — el backend ya guarda la geometría real
  /// con todos sus vértices viales en `solicitud.ruta_osrm`. Si por algún
  /// motivo no está disponible, el componente intentará calcular con su
  /// propio cliente Mapbox como fallback (y si todo falla, no dibuja).
  readonly serverWorkshopRoute = computed(() => {
    // Preferimos la ruta vial taller→incidente que el backend computa en el
    // seguimiento (flujo "taller sin técnico"); si no, la ruta cliente→taller
    // persistida en `solicitud.ruta_osrm`. Ambas son GeoJSON LineString.
    const raw = this.seguimiento()?.ruta_seguimiento ?? this.solicitud()?.ruta_osrm;
    if (!raw || typeof raw !== 'object') return null;
    const geom = raw as { type?: string; coordinates?: [number, number][] };
    if (geom.type !== 'LineString' || !Array.isArray(geom.coordinates)) return null;
    return geom;
  });
  readonly displayEtaMin = computed(() => this.liveRouteEtaMin() ?? this.seguimiento()?.eta_min ?? null);
  readonly displayDistanceKm = computed(() => this.liveRouteDistanceKm() ?? this.seguimiento()?.distancia_km ?? null);
  readonly trackingRouteColor = computed(() => this.seguimiento()?.route_color || '#2563eb');
  readonly shouldRenderTrackingRoute = computed(() => {
    const current = this.seguimiento();
    const state = normalizeSolicitudState(current?.estado || this.solicitud()?.estado?.nombre || '');
    const serviceState = normalizeSolicitudState(current?.servicio_estado || '');
    const hasProfessional = !!this.trackingProfessionalLocation();
    const hasService = !!this.trackingServiceLocation();
    const accepted =
      serviceState === 'ACEPTADO_TALLER' || serviceState === 'EN_CAMINO' || serviceState === 'EN_ATENCION';
    const operational = state === 'EN_CAMINO' || state === 'EN_ATENCION';
    return hasProfessional && hasService && (current?.tracking_activo === true || accepted || operational);
  });
  private readonly evidenceErrorById = signal<Record<number, boolean>>({});
  private trackingRefreshTimer: number | null = null;

  selectedWorkshopId: number | null = null;
  selectedTechnicianId: number | null = null;
  assignmentNote = 'Confirmo disponibilidad operativa';
  workshopNote = 'El taller confirma cobertura';
  clientNote = 'Apruebo el taller sugerido para continuar';
  paymentMethod = 'tarjeta';
  paymentAmount: number | null = null;
  paymentReference = '';
  paymentNote = 'Registro de pago realizado por el cliente';
  finalCostAmount: number | null = null;
  finalizationNote = 'Trabajo realizado y listo para facturar al cliente';
  statusNote = 'Actualización registrada desde la web';
  cancelNote = 'Cancelación solicitada por el usuario';
  manualSummary = 'Clasificación validada manualmente por operación';
  manualReason = 'Se ajustó la prioridad según revisión humana';
  manualPriority: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA' = 'MEDIA';

  constructor() {
    this.tracking.connect();
    this.reload();
    this.trackingRefreshTimer = window.setInterval(() => this.reloadTrackingOnly(), 15000);
  }

  ngOnDestroy(): void {
    this.tracking.disconnect();
    if (this.trackingRefreshTimer !== null) {
      window.clearInterval(this.trackingRefreshTimer);
      this.trackingRefreshTimer = null;
    }
  }

  reload() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      return;
    }
    this.candidatos.set(null);
    this.api.getSolicitudDetalle(id).subscribe({
      next: (data) => {
        this.solicitud.set(data);
        if (!this.selectedWorkshopId && data.taller_id) {
          this.selectedWorkshopId = data.taller_id;
        }
        if (!this.selectedTechnicianId && data.tecnico_id) {
          this.selectedTechnicianId = data.tecnico_id;
        }
        if (this.finalCostAmount === null && data.costo_final !== null && data.costo_final !== undefined) {
          this.finalCostAmount = data.costo_final;
        }
        if (this.paymentAmount === null) {
          this.paymentAmount = data.costo_final ?? data.costo_estimado ?? null;
        }

        if (this.canProposeAssignment()) {
          this.api.getCandidatosSolicitud(id).subscribe((cand) => this.candidatos.set(cand));
        }
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 403 || error.status === 404) {
          void this.router.navigate(['/solicitudes'], { queryParams: { blocked: 'request' } });
        }
      }
    });
    this.api.getSeguimientoSolicitud(id).subscribe((data) => this.seguimiento.set(data));
    this.api.getEstadosSolicitud().subscribe((data) => this.estados.set(data));
  }

  reloadTrackingOnly() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      return;
    }
    this.api.getSeguimientoSolicitud(id).subscribe((data) => this.seguimiento.set(data));
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

  openEvidence(ev: Evidencia) {
    if (ev.tipo !== 'IMAGE') {
      return;
    }
    if (this.evidenceFailed(ev.id)) {
      return;
    }
    this.selectedEvidence.set(ev);
  }

  closeEvidence() {
    this.selectedEvidence.set(null);
  }

  markEvidenceError(evidenceId: number) {
    const current = this.evidenceErrorById();
    if (current[evidenceId]) {
      return;
    }
    this.evidenceErrorById.set({ ...current, [evidenceId]: true });
  }

  evidenceFailed(evidenceId: number) {
    return Boolean(this.evidenceErrorById()[evidenceId]);
  }

  buildEvidenceUrl(ev: Evidencia) {
    const base = environment.apiUrl.replace(/\/$/, '');
    const rawPath = ev.url || `/solicitudes/evidencias/${ev.id}/archivo`;
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    let url = `${base}${path}`;
    const token = this.authService.getToken();
    if (token) {
      url = `${url}?access_token=${encodeURIComponent(token)}`;
    }
    return url;
  }

  showAiBlock(): boolean {
    const current = this.solicitud();
    return Boolean(
      current?.resumen_ia ||
      current?.transcripcion_audio ||
      current?.transcripcion_audio_estado ||
      current?.transcripcion_audio_error ||
      current?.motivo_prioridad ||
      current?.etiquetas_ia ||
      current?.requiere_revision_manual
    );
  }

  hasEstimatedCost(): boolean {
    return this.solicitud()?.costo_estimado !== null && this.solicitud()?.costo_estimado !== undefined;
  }

  hasFinalCost(): boolean {
    return this.solicitud()?.costo_final !== null && this.solicitud()?.costo_final !== undefined;
  }

  formatBs(amount: number | null | undefined): string {
    const safeAmount = Number(amount ?? 0);
    return `Bs ${safeAmount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /// Versión compacta sin "Bs" prefix — usada en el número grande del
  /// hero card. Mostramos miles con separador "." (estilo boliviano:
  /// "3.380" no "3,380") porque "Bs" ya aparece como prefijo aparte.
  formatBsCompact(amount: number | null | undefined): string {
    const safeAmount = Number(amount ?? 0);
    return safeAmount.toLocaleString('es-BO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  /// Posición del marcador "más probable" dentro de la barra de rango.
  /// Devuelve el % desde la izquierda. Cap a [0,100] por si los datos
  /// vienen inconsistentes (mas_probable fuera de min/max).
  rangeMarkerPosition(): number {
    const s = this.solicitud();
    if (!s) return 50;
    const min = s.costo_estimado_min;
    const max = s.costo_estimado_max;
    const probable = s.costo_estimado;
    if (min == null || max == null || probable == null || max <= min) return 50;
    const pct = ((probable - min) / (max - min)) * 100;
    return Math.max(2, Math.min(98, pct));
  }

  /// Parsea la `costo_estimacion_nota` del backend en factores visuales
  /// para mostrar como chips. Si la nota viene en un formato no esperado,
  /// devuelve [] — el caller no muestra la grilla, solo el toggle de
  /// detalles técnicos.
  ///
  /// La nota típica tiene la forma:
  ///   "Bolivia: base accidente=2200.0 Bs. f_antiguedad=1.0 (2013-2019).
  ///    f_complejidad=0.92 (economico). f_severidad=1.318 (riesgo=4,
  ///    prioridad=ALTA). f_region=1.0 (bolivia). f_evidencia=1.269.
  ///    f_evidencia_visual=1.0. margen=0.164 por confianza=0.89.
  ///    Señales consideradas: choque."
  ///
  /// Extraemos los factores semánticamente útiles. Es defensivo —
  /// cualquier regex que no matchee se omite del resultado, NUNCA
  /// rompe.
  costFactors(): Array<{ label: string; value: string; icon: string; iconText: string }> {
    const note = this.solicitud()?.costo_estimacion_nota;
    if (!note) return [];

    const factors: Array<{ label: string; value: string; icon: string; iconText: string }> = [];

    // Base del incidente (cifra entera en Bs)
    const baseMatch = note.match(/base\s+\w+=([\d.]+)\s*Bs/i);
    if (baseMatch) {
      factors.push({
        label: 'Base del incidente',
        value: `Bs ${Math.round(Number(baseMatch[1]))}`,
        icon: 'base', iconText: '💼',
      });
    }

    // Antigüedad del vehículo: f_antiguedad=1.0 (2013-2019)
    const antMatch = note.match(/f_antiguedad=([\d.]+)\s*\(([^)]+)\)/i);
    if (antMatch) {
      factors.push({
        label: 'Antigüedad',
        value: `${antMatch[2]} · ×${Number(antMatch[1]).toFixed(2)}`,
        icon: 'year', iconText: '📅',
      });
    }

    // Complejidad: f_complejidad=0.92 (economico)
    const compMatch = note.match(/f_complejidad=([\d.]+)\s*\(([^)]+)\)/i);
    if (compMatch) {
      factors.push({
        label: 'Complejidad',
        value: `${this.capitalize(compMatch[2])} · ×${Number(compMatch[1]).toFixed(2)}`,
        icon: 'complexity', iconText: '🔧',
      });
    }

    // Severidad: f_severidad=1.318 (riesgo=4, prioridad=ALTA)
    const sevMatch = note.match(/f_severidad=([\d.]+)\s*\(([^)]+)\)/i);
    if (sevMatch) {
      const ctx = sevMatch[2]; // "riesgo=4, prioridad=ALTA"
      const riesgo = ctx.match(/riesgo=(\d+)/i)?.[1];
      const prioridad = ctx.match(/prioridad=(\w+)/i)?.[1];
      const desc: string[] = [];
      if (prioridad) desc.push(`Prioridad ${prioridad}`);
      if (riesgo) desc.push(`Riesgo ${riesgo}`);
      factors.push({
        label: 'Severidad',
        value: `${desc.join(' · ')} · ×${Number(sevMatch[1]).toFixed(2)}`,
        icon: 'risk', iconText: '⚠️',
      });
    }

    // Evidencia: f_evidencia=1.269
    const evMatch = note.match(/f_evidencia=([\d.]+)/i);
    if (evMatch) {
      const factor = Number(evMatch[1]);
      const quality = factor >= 1.2 ? 'Alta' : factor >= 1.0 ? 'Media' : 'Baja';
      factors.push({
        label: 'Evidencia',
        value: `${quality} · ×${factor.toFixed(2)}`,
        icon: 'evidence', iconText: '📋',
      });
    }

    // Señales consideradas: choque
    const sigMatch = note.match(/Señales consideradas:\s*([^.]+)/i);
    if (sigMatch) {
      factors.push({
        label: 'Tipo de incidente',
        value: sigMatch[1].trim().split(/[,\s]+/).map(s => this.capitalize(s)).join(', '),
        icon: 'signal', iconText: '🚗',
      });
    }

    // Margen aplicado: margen=0.164 por confianza=0.89
    const margenMatch = note.match(/margen=([\d.]+)\s+por\s+confianza=([\d.]+)/i);
    if (margenMatch) {
      const pct = Math.round(Number(margenMatch[1]) * 100);
      const conf = Math.round(Number(margenMatch[2]) * 100);
      factors.push({
        label: 'Margen por confianza',
        value: `±${pct}% (confianza ${conf}%)`,
        icon: 'margin', iconText: '📊',
      });
    }

    return factors;
  }

  private capitalize(s: string): string {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
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
      ['EN_ATENCION', 'COMPLETADA'].includes(currentState) &&
      currentState !== 'CANCELADA' &&
      current?.cliente_aprobada !== false &&
      current?.trabajo_terminado === true
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
    // La caja comparte el textarea `assignmentNote`; usamos lo que escribió el
    // taller y, si lo dejó vacío, caemos a la nota por defecto.
    const nota = this.assignmentNote.trim() || this.workshopNote.trim();
    if (current && nota.length >= 3) {
      this.api.responderAsignacionTaller(current.id, accepted, nota).subscribe({
        next: () => {
          this.feedback.set(accepted ? 'Asignación aceptada por el taller.' : 'Asignación rechazada.');
          this.reload();
        },
        error: (err) => this.feedback.set(this.extractError(err, 'No se pudo registrar la respuesta del taller.'))
      });
    }
  }

  private extractError(err: unknown, fallback: string): string {
    const detail = (err as { error?: { detail?: unknown } })?.error?.detail;
    return typeof detail === 'string' && detail.trim() ? detail : fallback;
  }

  changeStatus(target: string) {
    const current = this.solicitud();
    const stateId = this.estados().find((item) => item.nombre === target)?.id;
    if (current && stateId && this.statusNote.trim().length >= 3) {
      this.api.actualizarEstado(current.id, stateId, this.statusNote.trim(), target).subscribe(() => this.reload());
    }
  }

  /// El botón de despacho simulado solo aplica a talleres SIN técnico asignado:
  /// el operador dispara la salida del taller hacia el incidente desde ASIGNADA.
  canSimulateDispatch(): boolean {
    const current = this.solicitud();
    const currentState = current?.estado?.nombre;
    // ADMIN/OPERADOR pueden despachar cualquier solicitud; el TALLER dueño
    // también, para operar sin técnico (el backend valida la pertenencia).
    const canDispatch = this.roleNames().some((role) =>
      ['ADMINISTRADOR', 'OPERADOR', 'TALLER'].includes(role),
    );
    return (
      canDispatch &&
      currentState === 'ASIGNADA' &&
      current?.cliente_aprobada !== false &&
      !this.seguimiento()?.tecnico_id &&
      !!this.trackingWorkshopLocation()
    );
  }

  /// Simula el viaje taller → incidente: pasa a EN_CAMINO, anima el muñeco en
  /// el mapa y, al llegar, marca EN_ATENCION. El móvil ve los cambios de estado.
  simulateDispatch(): void {
    const current = this.solicitud();
    if (!current || this.simulating()) return;
    const enCaminoId = this.estados().find((item) => item.nombre === 'EN_CAMINO')?.id;
    const enAtencionId = this.estados().find((item) => item.nombre === 'EN_ATENCION')?.id;
    if (!enCaminoId || !enAtencionId) {
      this.feedback.set('No se encontraron los estados EN_CAMINO/EN_ATENCION en el catálogo.');
      return;
    }
    this.simulating.set(true);
    this.feedback.set('Equipo del taller saliendo hacia el incidente…');
    this.api.actualizarEstado(current.id, enCaminoId, 'Equipo en camino al incidente (despacho desde la web).', 'EN_CAMINO').subscribe({
      next: async () => {
        this.reloadTrackingOnly();
        try {
          await this.trackingMap?.playDispatch(12000);
        } catch {
          // Si la animación falla igual avanzamos el estado.
        }
        this.api.actualizarEstado(current.id, enAtencionId, 'Equipo llegó al lugar del incidente.', 'EN_ATENCION').subscribe({
          next: () => {
            this.feedback.set('Equipo en atención en el lugar del incidente.');
            this.simulating.set(false);
            this.reload();
          },
          error: (err) => {
            this.feedback.set(this.extractError(err, 'No se pudo marcar En atención.'));
            this.simulating.set(false);
          }
        });
      },
      error: (err) => {
        this.feedback.set(this.extractError(err, 'No se pudo iniciar el despacho.'));
        this.simulating.set(false);
      }
    });
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
    const monto = this.paymentAmount ?? current?.costo_final ?? current?.costo_estimado ?? null;
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

  async submitTechnicalClosure() {
    const current = this.solicitud();
    const amount = this.finalCostAmount ?? current?.costo_estimado ?? null;
    if (!current || !amount || amount <= 0 || this.finalizationNote.trim().length < 5) {
      return;
    }
    const payload: TrabajoFinalizadoPayload = {
      costo_final: amount,
      observacion: this.finalizationNote.trim()
    };
    // El técnico asignado confirma su ubicación contra el punto del servicio.
    // El taller sin técnico cierra desde el panel y no comparte GPS.
    if (current.tecnico_id) {
      const location = await this.captureCurrentLocation();
      if (!location) {
        window.alert('Debes compartir tu ubicación actual para cerrar el trabajo.');
        return;
      }
      payload.latitud_confirmacion = location.lat;
      payload.longitud_confirmacion = location.lng;
    }
    this.api.registrarTrabajoFinalizado(current.id, payload).subscribe(() => this.reload());
  }

  canRespondAssignment(): boolean {
    const current = this.solicitud();
    return this.roleNames().includes('TECNICO') && current?.estado?.nombre === 'ASIGNADA' && current.cliente_aprobada === true;
  }

  canRespondWorkshopAssignment(): boolean {
    const current = this.solicitud();
    if (!this.roleNames().includes('TALLER')) {
      return false;
    }
    const estado = current?.estado?.nombre;
    // Flujo nuevo cliente↔taller-directo: el cliente eligió este taller y la
    // solicitud quedó en PROPUESTA_TALLER esperando que el taller acepte o
    // rechace. (Si el taller tiene aceptación automática, el backend ya pasó
    // a ASIGNADA y nunca se ve este estado.)
    if (estado === 'PROPUESTA_TALLER') {
      return true;
    }
    // Flujo legacy: el taller confirma una asignación ya aprobada por el cliente.
    // Pero una vez que el taller ya aceptó (servicio en ACEPTADO_TALLER o más
    // avanzado) el estado se queda en ASIGNADA, así que escondemos los botones
    // para no invitar a "re-aceptar" algo que ya está aceptado.
    if (estado !== 'ASIGNADA' || current?.cliente_aprobada !== true) {
      return false;
    }
    const servicioEstado = current?.servicio_demanda?.estado ?? '';
    const yaAceptado = ['ACEPTADO_TALLER', 'EN_CAMINO', 'EN_ATENCION', 'COMPLETADO', 'FINALIZADO'].includes(servicioEstado);
    return !yaAceptado;
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
    return canOperate && currentState === 'EN_CAMINO' && target === 'EN_ATENCION';
  }

  canCancel(): boolean {
    const currentState = this.solicitud()?.estado?.nombre;
    if (!currentState || ['COMPLETADA', 'CANCELADA'].includes(currentState)) {
      return false;
    }
    const roles = this.roleNames();
    return roles.includes('ADMINISTRADOR') || roles.includes('OPERADOR') || (roles.includes('CLIENTE') && currentState !== 'EN_ATENCION');
  }

  canFinalizeTechnicalWork(): boolean {
    const current = this.solicitud();
    if (current?.estado?.nombre !== 'EN_ATENCION' || current?.trabajo_terminado === true) {
      return false;
    }
    const roles = this.roleNames();
    // Técnico asignado: cierra confirmando su GPS.
    if (roles.includes('TECNICO') && current?.tecnico_id) {
      return true;
    }
    // Taller dueño sin técnico: cierra desde el panel web (sin GPS).
    // El backend valida la propiedad del taller; aquí basta con que no
    // haya técnico asignado para mostrar el botón.
    return roles.includes('TALLER') && !current?.tecnico_id;
  }

  canDownloadInvoice(): boolean {
    const roles = this.roleNames();
    const allowedRole = roles.some((role) => ['CLIENTE', 'OPERADOR', 'ADMINISTRADOR'].includes(role));
    return allowedRole && this.latestPayment()?.estado === 'PAGADO';
  }

  openInvoice() {
    const current = this.solicitud();
    if (!current) {
      return;
    }
    window.open(this.api.getFacturaSolicitudUrl(current.id), '_blank', 'noopener,noreferrer');
  }

  onRouteMetricsChange(metrics: { distanceKm: number; durationMin: number } | null) {
    this.liveRouteDistanceKm.set(metrics?.distanceKm ?? null);
    this.liveRouteEtaMin.set(metrics?.durationMin ?? null);
  }

  private async captureCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return null;
    }
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        });
      });
      return {
        lat: Number(position.coords.latitude),
        lng: Number(position.coords.longitude)
      };
    } catch {
      return null;
    }
  }
}

export {};
