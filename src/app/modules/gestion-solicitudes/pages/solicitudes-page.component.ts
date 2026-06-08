import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EmergencyApiService } from '../../../core/services/gestion-solicitudes/emergency-api.service';
import { AuthService } from '../../../core/services/autenticacion-acceso/auth.service';
import { EstadoSolicitudOption, Solicitud, Taller } from '../../../core/models/gestion-solicitudes/api.models';
import { canProposeWorkshopAssignment } from '../../../core/utils/solicitud-assign';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-solicitudes-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent],
  template: `
    <section class="management-container">
      <header class="page-header">
        <div class="title-group">
          <h2>Gestión de Solicitudes</h2>
          <p>Asignación de unidades y control de flujo de trabajo</p>
        </div>
        <button (click)="loadData()" class="btn-refresh" [disabled]="isLoading()">
          <span class="icon" [class.spinning]="isLoading()" aria-hidden="true"><app-icon name="refresh" [size]="16" /></span>
          Sincronizar
        </button>
      </header>

      <div class="request-list">
        <div class="access-notice" *ngIf="accessNotice() as notice">
          <app-icon name="alert" [size]="18" />
          <span>{{ notice }}</span>
        </div>

        <div *ngIf="solicitudes().length === 0 && !isLoading()" class="empty-state">
          <div class="empty-icon" aria-hidden="true"><app-icon name="folder" [size]="36" /></div>
          <p>No hay solicitudes pendientes de atención.</p>
        </div>

        <article class="request-card" *ngFor="let solicitud of solicitudes()">
          <div class="request-info">
            <header>
              <span class="id-tag">#{{ solicitud.id }}</span>
              <span class="incident-type">{{ solicitud.tipo_incidente?.nombre }}</span>
              <span class="priority-badge" [attr.data-priority]="solicitud.prioridad">
                {{ solicitud.prioridad }}
              </span>
            </header>
            
            <p class="description">{{ solicitud.descripcion }}</p>

            <!-- Diagnóstico IA: bloque etiquetado y prominente para que el
                 operador sepa de un vistazo qué tipo de problema reporta el
                 cliente, sin tener que abrir el detalle. Solo aparece si hay
                 algún dato de diagnóstico (categoría / nivel / etiquetas /
                 revisión manual). Resalta más fuerte en REGISTRADA porque ahí
                 es donde el operador toma la decisión de a quién asignar. -->
            <div class="ai-diagnostic"
                 *ngIf="hasAiDiagnostic(solicitud)"
                 [class.is-new]="solicitud.estado?.nombre === 'REGISTRADA'">
              <span class="ai-label">Diagnóstico técnico</span>
              <span class="ai-value">{{ aiDiagnosticSummary(solicitud) }}</span>
            </div>

            <div class="secondary-tags">
              <span class="mini-tag" *ngIf="solicitud.requiere_revision_manual">Diagnóstico pendiente</span>
              <span class="mini-tag" *ngIf="solicitud.cliente_aprobada === false">Pendiente cliente</span>
              <span class="mini-tag success" *ngIf="solicitud.cliente_aprobada === true">Cliente aprobó</span>
              <span class="mini-tag warning" *ngIf="solicitud.costo_estimado">Estimado {{ formatBs(solicitud.costo_estimado) }}</span>
              <span class="mini-tag success" *ngIf="solicitud.trabajo_terminado && solicitud.costo_final">Trabajo hecho {{ formatBs(solicitud.costo_final) }}</span>
            </div>
            
            <footer class="metadata">
              <span class="status-indicator">
                <span class="status-dot" [attr.data-status]="solicitud.estado?.nombre"></span>
                Estado: <strong>{{ solicitud.estado?.nombre }}</strong>
              </span>
              <span class="tech-assigned" *ngIf="solicitud.taller_id || solicitud.tecnico">
                <app-icon name="wrench" [size]="14" />
                Taller: {{ tallerNombre(solicitud) }}<ng-container *ngIf="solicitud.tecnico"> · Téc: {{ solicitud.tecnico.nombre }}</ng-container>
              </span>
            </footer>
          </div>

          <div class="request-actions">
            <a class="btn-detail" [routerLink]="['/solicitudes', solicitud.id]">
              Ver Historial
            </a>

            <div class="assign-zone" *ngIf="canAssign() && canAssignSolicitud(solicitud)">
              <select [(ngModel)]="selectedTalleres[solicitud.id]" class="tech-select">
                <option [ngValue]="undefined">Seleccionar taller...</option>
                <option *ngFor="let taller of availableTalleres()" [ngValue]="taller.id">
                  {{ taller.nombre }}{{ taller.acepta_automaticamente ? ' (auto)' : '' }}
                </option>
              </select>
              <button class="btn-assign" (click)="assign(solicitud.id)">Asignar Unidad</button>
            </div>

            <div class="status-workflow">
              <button
                class="btn-flow attention"
                *ngIf="canAdvanceTo(solicitud, 'EN_ATENCION')"
                (click)="changeStatusByName(solicitud.id, 'EN_ATENCION', 'Servicio iniciado desde panel web')">
                Iniciar Atención
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: `
    :host { --primary: #2563eb; --dark: #0f172a; --gray: #64748b; --bg: #f8fafc; }

    .management-container { padding: 2rem; background: var(--bg); min-height: 100vh; }

    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .page-header h2 { margin: 0; color: var(--dark); font-size: 1.75rem; }
    .page-header p { margin: 0.25rem 0 0; color: var(--gray); }

    /* Listado */
    .request-list { display: grid; gap: 1.25rem; }
    .access-notice {
      display: flex; align-items: center; gap: 0.6rem;
      padding: 0.85rem 1rem; border-radius: 12px;
      background: #fff7ed; color: #9a3412; border: 1px solid #fdba74;
      font-weight: 600;
    }

    .request-card {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 2rem;
      background: white;
      padding: 1.5rem;
      border-radius: 20px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
      border: 1px solid #f1f5f9;
      transition: transform 0.2s;
    }
    .request-card:hover { transform: translateY(-2px); border-color: #e2e8f0; }

    /* Info de la solicitud */
    .request-info header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .id-tag { font-family: monospace; font-weight: 800; color: var(--gray); font-size: 1.1rem; }
    .incident-type { font-weight: 700; color: var(--dark); font-size: 1.1rem; }
    
    .priority-badge {
      padding: 0.25rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
      background: #f1f5f9; color: var(--gray);
    }
    .priority-badge[data-priority="CRITICA"] { background: #fee2e2; color: #ef4444; }

    .description { color: #475569; line-height: 1.5; margin-bottom: 0.75rem; font-size: 0.95rem; }
    .secondary-tags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .mini-tag { background: #e2e8f0; color: #334155; border-radius: 999px; padding: 0.25rem 0.55rem; font-size: 0.72rem; font-weight: 700; }
    .mini-tag.success { background: #dcfce7; color: #166534; }
    .mini-tag.warning { background: #fef3c7; color: #92400e; }

    /* Bloque de diagnóstico IA — labeled y visible para que el operador
       sepa de un vistazo qué TIPO de problema reporta el cliente. Se realza
       (border más fuerte) cuando la solicitud está REGISTRADA, porque ahí
       es donde el operador decide a quién asignar. */
    .ai-diagnostic {
      display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
      background: #eff6ff; border: 1px solid #dbeafe;
      border-left: 3px solid #2563eb;
      padding: 0.55rem 0.85rem; border-radius: 8px;
      margin-bottom: 0.85rem; font-size: 0.88rem;
    }
    .ai-diagnostic.is-new { border-left-width: 5px; background: #dbeafe; }
    .ai-label {
      font-weight: 800; color: #1d4ed8;
      text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.6px;
      background: white; padding: 0.18rem 0.55rem; border-radius: 4px;
      border: 1px solid #bfdbfe;
    }
    .ai-value { color: #1e3a8a; font-weight: 600; }

    .metadata { display: flex; gap: 1.5rem; font-size: 0.85rem; color: var(--gray); padding-top: 1rem; border-top: 1px solid #f8fafc; flex-wrap: wrap; }
    .status-indicator { display: flex; align-items: center; gap: 0.5rem; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; }
    .status-dot[data-status="EN_CAMINO"] { background: #3b82f6; box-shadow: 0 0 8px #3b82f6; }
    .status-dot[data-status="EN_ATENCION"] { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }

    /* Acciones */
    .request-actions { display: flex; flex-direction: column; gap: 0.75rem; border-left: 1px solid #f1f5f9; padding-left: 1.5rem; }

    .btn-detail {
      text-align: center; padding: 0.6rem; background: #f1f5f9; color: var(--dark);
      text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 0.85rem; transition: 0.2s;
    }
    .btn-detail:hover { background: #e2e8f0; }

    .assign-zone { display: grid; gap: 0.5rem; padding: 0.75rem; background: #f8fafc; border-radius: 12px; }
    .tech-select { padding: 0.6rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; }
    .btn-assign { background: var(--primary); color: white; border: none; padding: 0.6rem; border-radius: 8px; font-weight: 700; cursor: pointer; }

    .status-workflow { display: grid; gap: 0.5rem; }
    .btn-flow { padding: 0.75rem; border: none; border-radius: 10px; color: white; font-weight: 700; cursor: pointer; transition: 0.2s; }
    .btn-flow.attention { background: var(--dark); }
    .btn-flow.success { background: #15803d; }
    .btn-flow:hover { opacity: 0.9; transform: scale(1.02); }

    /* Utils */
    .btn-refresh { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; border: 1.5px solid #e2e8f0; background: white; border-radius: 10px; font-weight: 600; cursor: pointer; }
    .icon { display: inline-flex; align-items: center; justify-content: center; }
    .spinning { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-state { text-align: center; padding: 4rem; color: var(--gray); }
    .empty-icon { margin-bottom: 1rem; opacity: 0.45; display: inline-flex; align-items: center; justify-content: center; }
    .tech-assigned { display: inline-flex; align-items: center; gap: 0.45rem; }

    @media (max-width: 900px) {
      .management-container { padding: 1rem; }
      .page-header { flex-direction: column; align-items: stretch; gap: 1rem; }
      .btn-refresh { width: 100%; justify-content: center; }
      .request-card { grid-template-columns: 1fr; gap: 1rem; }
      .request-actions { border-left: none; padding-left: 0; border-top: 1px solid #f1f5f9; padding-top: 1rem; }
    }

    @media (max-width: 640px) {
      .request-card { padding: 1rem; }
      .assign-zone, .status-workflow { gap: 0.75rem; }
      .btn-detail, .btn-assign, .btn-flow { width: 100%; }
      .tech-select { width: 100%; }
    }
  `
})
export class SolicitudesPageComponent {
  private readonly api = inject(EmergencyApiService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly solicitudes = signal<Solicitud[]>([]);
  readonly talleres = signal<Taller[]>([]);
  readonly estados = signal<EstadoSolicitudOption[]>([]);
  readonly isLoading = signal(false);
  readonly accessNotice = signal<string | null>(null);

  readonly canAssign = computed(() => this.authService.hasAnyRole(['ADMINISTRADOR', 'OPERADOR']));
  // El operador propone un TALLER (no un técnico): el backend buscará un técnico
  // disponible dentro de ese taller o seguirá el flujo SIN_TECNICO. /talleres ya
  // filtra disponible=true en el servidor; reforzamos por si acaso.
  readonly availableTalleres = computed(() => this.talleres().filter((t) => t.disponible !== false));

  selectedTalleres: Record<number, number | undefined> = {};

  constructor() {
    if (this.route.snapshot.queryParamMap.get('blocked') === 'request') {
      this.accessNotice.set('No tienes permisos para ver la solicitud seleccionada.');
    }
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    // Para simplificar, asumimos que todas las llamadas terminan
    this.api.getSolicitudesActivas().subscribe((data) => {
      this.solicitudes.set(data);
      this.isLoading.set(false);
    });
    this.api.getTalleres().subscribe((data) => this.talleres.set(data));
    this.api.getEstadosSolicitud().subscribe((data) => this.estados.set(data));
  }

  assign(solicitudId: number) {
    const tallerId = this.selectedTalleres[solicitudId];
    if (!tallerId) return;
    // Se envía solo el taller_id: el backend resuelve el técnico (o deja el
    // servicio en SIN_TECNICO si el taller aún no tiene uno disponible).
    this.api.asignarTecnico(solicitudId, null, tallerId).subscribe(() => this.loadData());
  }

  tallerNombre(solicitud: Solicitud): string {
    const taller = this.talleres().find((t) => t.id === solicitud.taller_id);
    return taller?.nombre ?? solicitud.tecnico?.nombre ?? `#${solicitud.taller_id ?? ''}`;
  }

  canAssignSolicitud(solicitud: Solicitud): boolean {
    if (solicitud.tecnico_id) return false;
    return canProposeWorkshopAssignment({
      estadoNombre: solicitud.estado?.nombre,
      tecnicoId: solicitud.tecnico_id ?? null,
      clienteAprobada: solicitud.cliente_aprobada ?? null
    });
  }

  changeStatusByName(solicitudId: number, estado: string, observacion: string) {
    const estadoId = this.estados().find((item) => item.nombre === estado)?.id;
    if (!estadoId) return;
    this.api.actualizarEstado(solicitudId, estadoId, observacion, estado).subscribe(() => this.loadData());
  }

  formatBs(amount: number | null | undefined) {
    const safeAmount = Number(amount ?? 0);
    return `Bs ${safeAmount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  canAdvanceTo(solicitud: Solicitud, targetState: string) {
    const currentState = solicitud.estado?.nombre;
    if (!currentState) return false;

    const validTransitions: Record<string, string> = {
      'EN_CAMINO': 'EN_ATENCION'
    };

    return validTransitions[currentState] === targetState;
  }

  // ── Diagnóstico IA: helpers para el bloque etiquetado del card ─────────
  //
  // El operador antes tenía que adivinar el tipo de problema desde un mini-tag
  // de "etiquetas_ia" sin contexto. Ahora le mostramos un resumen ordenado:
  // categoría · nivel de riesgo · etiquetas extra · marca de revisión manual.

  hasAiDiagnostic(s: Solicitud): boolean {
    return Boolean(
      this.isEmptyTankRequest(s) ||
      (s.categoria_dano && s.categoria_dano !== 'general') ||
      s.etiquetas_ia ||
      s.nivel_riesgo != null ||
      s.requiere_revision_manual
    );
  }

  aiDiagnosticSummary(s: Solicitud): string {
    const parts: string[] = [];
    if (this.isEmptyTankRequest(s)) {
      parts.push('Tanque vacío');
    } else if (s.categoria_dano && s.categoria_dano !== 'general') {
      parts.push(this.categoryLabel(s.categoria_dano));
    }
    if (s.nivel_riesgo != null) {
      parts.push(`riesgo ${this.riskLabel(s.nivel_riesgo)}`);
    }
    if (s.etiquetas_ia) {
      parts.push(
        String(s.etiquetas_ia)
          .split('|')
          .map((tag) => this.categoryLabel(tag))
          .join(' · ')
      );
    }
    if (s.requiere_revision_manual) {
      parts.push('requiere diagnóstico manual');
    }
    return parts.length > 0 ? parts.join(' · ') : 'sin diagnóstico técnico';
  }

  private categoryLabel(cat: string): string {
    const map: Record<string, string> = {
      'llanta': 'Llantas',
      'llantas': 'Llantas',
      'motor': 'Motor',
      'bateria': 'Batería',
      'batería': 'Batería',
      'choque': 'Carrocería / choque',
      'electrico': 'Eléctrico',
      'eléctrico': 'Eléctrico',
      'combustible': 'Combustible',
      'tanque_vacio': 'Tanque vacío',
      'tanque vacío': 'Tanque vacío',
      'tanque vacio': 'Tanque vacío',
      'general': 'General'
    };
    return map[cat.toLowerCase()] ?? cat;
  }

  private isEmptyTankRequest(s: Solicitud): boolean {
    const source = [
      s.tipo_incidente?.nombre ?? '',
      s.descripcion ?? '',
      s.etiquetas_ia ?? '',
      s.categoria_dano ?? ''
    ]
      .join(' ')
      .toLowerCase();
    return (
      source.includes('tanque_vacio') ||
      source.includes('tanque vacío') ||
      source.includes('tanque vacio') ||
      source.includes('sin combustible') ||
      source.includes('sin gasolina') ||
      source.includes('sin diesel')
    );
  }

  private riskLabel(n: number): string {
    if (n <= 1) return 'bajo';
    if (n <= 3) return 'medio';
    return 'alto';
  }
}
