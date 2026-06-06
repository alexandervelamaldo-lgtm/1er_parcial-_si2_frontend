import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { EmergencyApiService } from '../../../core/services/gestion-solicitudes/emergency-api.service';
import { LatLng, MapboxService } from '../../../core/services/mapa/mapbox.service';
import { CategoriaTaller, SolicitudCreatePayload, TallerMapa, TipoIncidenteOption, Vehiculo } from '../../../core/models/gestion-solicitudes/api.models';
import { MapaPickerComponent } from '../../../shared/components/mapa-picker/mapa-picker.component';
import { TalleresMapaSelectorComponent, TallerMapaPunto } from '../../../shared/components/talleres-mapa-selector/talleres-mapa-selector.component';

type WizardStep = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-solicitud-wizard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MapaPickerComponent, TalleresMapaSelectorComponent],
  template: `
    <section class="wizard">
      <header class="header">
        <div>
          <h2>Registrar accidente</h2>
          <p>Completa los datos del incidente y selecciona un taller adecuado antes de enviar la solicitud.</p>
        </div>
        <button class="btn-secondary" (click)="goBack()" type="button">Volver</button>
      </header>

      <nav class="steps">
        <button class="step" type="button" [class.active]="step() === 1" (click)="step.set(1)">1. Detalles</button>
        <button class="step" type="button" [class.active]="step() === 2" (click)="step.set(2)" [disabled]="!canGoToStep2()">2. Ubicación</button>
        <button class="step" type="button" [class.active]="step() === 3" (click)="step.set(3)" [disabled]="!canGoToStep3()">3. Taller</button>
        <button class="step" type="button" [class.active]="step() === 4" (click)="step.set(4)" [disabled]="!canGoToStep4()">4. Confirmar</button>
      </nav>

      <section class="panel" *ngIf="loadError()">
        <div class="error">{{ loadError() }}</div>
      </section>

      <section class="panel" *ngIf="step() === 1">
        <h3>Detalles del accidente</h3>

        <div class="grid">
          <label class="field">
            <span>Vehículo</span>
            <select class="input" [(ngModel)]="vehiculoIdModel" (ngModelChange)="vehiculoId.set($event)">
              <option [ngValue]="null">Selecciona un vehículo</option>
              <option *ngFor="let v of vehiculos()" [ngValue]="v.id">{{ v.marca }} {{ v.modelo }} ({{ v.placa }})</option>
            </select>
          </label>

          <label class="field">
            <span>Tipo de incidente</span>
            <select class="input" [(ngModel)]="tipoIncidenteIdModel" (ngModelChange)="tipoIncidenteId.set($event)">
              <option [ngValue]="null">Selecciona el tipo</option>
              <option *ngFor="let t of tiposIncidente()" [ngValue]="t.id">{{ t.nombre }}</option>
            </select>
          </label>

          <label class="field">
            <span>Fecha y hora del incidente</span>
            <input class="input" type="datetime-local" [(ngModel)]="fechaIncidente" />
          </label>

          <label class="field">
            <span>Categoría del daño</span>
            <select class="input" [(ngModel)]="categoriaDano">
              <option value="chaperia_pintura">Chapería y pintura</option>
              <option value="llantas">Llantas</option>
              <option value="motor">Motor</option>
              <option value="electricidad">Sistemas eléctricos</option>
              <option value="suspension">Suspensión</option>
              <option value="general">General</option>
            </select>
          </label>
        </div>

        <label class="field">
          <span>Daños del vehículo</span>
          <textarea class="input textarea" [(ngModel)]="danosDescripcion" rows="5" placeholder="Describe los daños observados (obligatorio)"></textarea>
        </label>

        <label class="field">
          <span>Descripción adicional</span>
          <textarea class="input textarea" [(ngModel)]="descripcionExtra" rows="4" placeholder="Detalles adicionales del incidente (opcional)"></textarea>
        </label>

        <div class="actions">
          <button class="btn-primary" type="button" (click)="nextFromDetails()" [disabled]="isBusy()">
            Continuar
          </button>
        </div>
      </section>

      <section class="panel" *ngIf="step() === 2">
        <h3>Ubicación geográfica del suceso</h3>
        <p class="hint">Selecciona el punto exacto del incidente y confirma tu geolocalización actual para continuar.</p>

        <div class="gps-box">
          <div>
            <strong>Geolocalización obligatoria</strong>
            <p class="gps-text">
              {{ requesterLocation() ? 'Ubicación del solicitante confirmada.' : 'Debes compartir tu ubicación real antes de generar la solicitud.' }}
            </p>
          </div>
          <button class="btn-secondary" type="button" (click)="captureRequesterLocation()" [disabled]="gpsLoading()">
            {{ gpsLoading() ? 'Ubicando…' : 'Confirmar mi ubicación' }}
          </button>
        </div>

        <div class="gps-status" *ngIf="requesterLocation() as requester">
          <span class="pill">Solicitante: {{ requester.lat | number:'1.4-4' }}, {{ requester.lng | number:'1.4-4' }}</span>
          <span class="pill" *ngIf="gpsConfirmedAt()">GPS validado recientemente</span>
        </div>
        <div class="error" *ngIf="gpsError()">{{ gpsError() }}</div>

        <app-mapa-picker
          [incidentPoints]="[]"
          [technicians]="[]"
          [unitLocation]="null"
          (locationConfirmed)="onLocationConfirmed($event)"
        />

        <div class="grid">
          <label class="field">
            <span>Latitud</span>
            <input class="input" [value]="location()?.lat ?? ''" readonly />
          </label>
          <label class="field">
            <span>Longitud</span>
            <input class="input" [value]="location()?.lng ?? ''" readonly />
          </label>
        </div>

        <label class="field">
          <span>Dirección (editable)</span>
          <input class="input" [(ngModel)]="ubicacionTexto" placeholder="Dirección aproximada del incidente" />
        </label>

        <div class="actions">
          <button class="btn-secondary" type="button" (click)="step.set(1)">Atrás</button>
          <button class="btn-primary" type="button" (click)="nextFromLocation()" [disabled]="isBusy() || !location() || !requesterLocation()">
            Continuar
          </button>
        </div>
      </section>

      <section class="panel" *ngIf="step() === 3">
        <h3>Selecciona un taller</h3>
        <p class="hint">Filtra por categoría y compara presupuestos estimados antes de elegir.</p>

        <div class="filters">
          <label class="field">
            <span>Categoría</span>
            <select class="input" [(ngModel)]="categoriaTallerIdModel" (ngModelChange)="onCategoriaTallerChanged($event)">
              <option [ngValue]="null">Todas</option>
              <option *ngFor="let c of categoriasTaller()" [ngValue]="c.id">{{ c.nombre }}</option>
            </select>
          </label>

          <label class="field">
            <span>Radio (km)</span>
            <input class="input" type="number" min="1" max="200" [(ngModel)]="radioKm" (ngModelChange)="reloadTalleres()" />
          </label>

          <button class="btn-secondary" type="button" (click)="reloadTalleres()" [disabled]="isBusy()">
            {{ loadingTalleres() ? 'Buscando…' : 'Actualizar' }}
          </button>
        </div>

        <div class="layout">
          <div class="map">
            <app-talleres-mapa-selector
              [talleres]="talleresForMap()"
              [origin]="origin()"
              [selectedTallerId]="selectedTallerId()"
              (tallerSelected)="onTallerSelected($event)"
            />
          </div>

          <div class="list">
            <div class="list-header">
              <strong>Opciones</strong>
              <span class="muted" *ngIf="loadingTalleres()">Cargando talleres…</span>
            </div>

            <article
              class="card"
              *ngFor="let t of talleres()"
              (click)="selectTaller(t.id)"
              [class.selected]="t.id === selectedTallerId()"
            >
              <div class="row">
                <strong>{{ t.nombre }}</strong>
                <span class="pill" *ngIf="t.categoria?.nombre">{{ t.categoria?.nombre }}</span>
              </div>
              <div class="row small">
                <span>{{ t.direccion }}</span>
              </div>
              <div class="row small">
                <span>Distancia: <strong>{{ t.distancia_km ?? '--' }} km</strong></span>
                <span>Rating: <strong>{{ (t.rating_promedio ?? 0) | number:'1.0-1' }}</strong> ({{ t.rating_total ?? 0 }})</span>
              </div>
              <div class="row small">
                <span>
                  Presupuesto:
                  <strong>{{ formatPresupuesto(t) }}</strong>
                  <span class="pill" *ngIf="t.descuento_porcentaje_aplicado != null && t.descuento_porcentaje_aplicado > 0">
                    -{{ t.descuento_porcentaje_aplicado | number:'1.0-0' }}%
                  </span>
                </span>
                <span>Tiempo: <strong>{{ t.tiempo_reparacion_horas ?? '--' }} h</strong></span>
              </div>
            </article>

            <div class="empty" *ngIf="!loadingTalleres() && (talleres().length === 0)">
              No se encontraron talleres con los filtros actuales.
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn-secondary" type="button" (click)="step.set(2)">Atrás</button>
          <button class="btn-primary" type="button" (click)="nextFromWorkshop()" [disabled]="isBusy() || !selectedTallerId()">
            Continuar
          </button>
        </div>
      </section>

      <section class="panel" *ngIf="step() === 4">
        <h3>Confirmación</h3>
        <div class="summary">
          <div class="item"><span>Vehículo</span><strong>{{ selectedVehiculoLabel() }}</strong></div>
          <div class="item"><span>Tipo</span><strong>{{ selectedTipoLabel() }}</strong></div>
          <div class="item"><span>Fecha</span><strong>{{ fechaIncidente || '--' }}</strong></div>
          <div class="item"><span>Ubicación</span><strong>{{ ubicacionTexto || '--' }}</strong></div>
          <div class="item"><span>Mi GPS</span><strong>{{ requesterLocationLabel() }}</strong></div>
          <div class="item"><span>Taller</span><strong>{{ selectedTallerLabel() }}</strong></div>
        </div>

        <label class="field">
          <span>Presupuesto aceptado (opcional)</span>
          <input class="input" type="number" min="1" [(ngModel)]="presupuestoAceptado" placeholder="Monto aproximado aceptado" />
        </label>

        <div class="actions">
          <button class="btn-secondary" type="button" (click)="step.set(3)">Atrás</button>
          <button class="btn-primary" type="button" (click)="submit()" [disabled]="isBusy()">
            {{ submitting() ? 'Enviando…' : 'Enviar solicitud' }}
          </button>
        </div>

        <div class="error" *ngIf="submitError()">{{ submitError() }}</div>
      </section>
    </section>
  `,
  styles: [
    `
      :host { --primary: #2563eb; --dark: #0f172a; --gray: #64748b; --bg: #f8fafc; }

      .wizard {
        display: grid;
        gap: 1.25rem;
        padding: 2rem;
        background: var(--bg);
        min-height: 100vh;
        font-family: 'Inter', sans-serif;
      }

      .header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      h2 {
        margin: 0;
        font-size: 1.75rem;
        font-weight: 800;
        color: var(--dark);
        letter-spacing: -0.5px;
      }

      .header p {
        margin: 0.25rem 0 0;
        color: var(--gray);
        font-size: 0.9rem;
      }

      .steps {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }

      .step {
        border: 1.5px solid #e2e8f0;
        background: white;
        color: var(--dark);
        border-radius: 12px;
        padding: 0.65rem 1rem;
        cursor: pointer;
        font-size: 0.82rem;
        font-weight: 600;
        transition: all 0.2s;
      }

      .step.active {
        border-color: var(--primary);
        background: #eff6ff;
        color: var(--primary);
        font-weight: 700;
      }

      .step:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .panel {
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 20px;
        padding: 1.5rem;
        background: white;
        box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
      }

      .hint {
        margin: 0 0 1rem;
        color: var(--gray);
        font-size: 0.88rem;
      }

      h3 {
        margin: 0 0 0.85rem;
        color: var(--dark);
        font-size: 1.15rem;
        font-weight: 700;
      }

      .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .field {
        display: grid;
        gap: 0.4rem;
        margin: 0.65rem 0;
      }

      .field span {
        font-size: 0.8rem;
        font-weight: 600;
        color: #334155;
      }

      .input {
        width: 100%;
        border-radius: 12px;
        border: 1.5px solid #e2e8f0;
        background: #f8fafc;
        color: var(--dark);
        padding: 0.75rem 0.95rem;
        font-size: 0.9rem;
        transition: all 0.2s;
      }

      .input:focus {
        outline: none;
        border-color: var(--primary);
        background: white;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
      }

      .textarea {
        resize: vertical;
        min-height: 100px;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 1.25rem;
        flex-wrap: wrap;
      }

      .btn-primary {
        border: none;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: white;
        border-radius: 12px;
        padding: 0.75rem 1.25rem;
        cursor: pointer;
        font-size: 0.88rem;
        font-weight: 700;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        transition: all 0.2s;
      }

      .btn-primary:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
      }

      .btn-secondary {
        border: 1.5px solid #e2e8f0;
        background: white;
        color: var(--dark);
        border-radius: 12px;
        padding: 0.75rem 1.25rem;
        cursor: pointer;
        font-size: 0.88rem;
        font-weight: 600;
        transition: all 0.2s;
      }

      .btn-secondary:hover:not(:disabled) {
        background: #f1f5f9;
        border-color: #cbd5e1;
      }

      .btn-primary:disabled,
      .btn-secondary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .error {
        margin-top: 0.85rem;
        padding: 0.75rem;
        background: #fef2f2;
        border: 1px solid #fee2e2;
        border-radius: 12px;
        color: #b91c1c;
        font-weight: 600;
        font-size: 0.85rem;
      }

      .gps-box {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        border: 1px solid rgba(37, 99, 235, 0.15);
        border-radius: 16px;
        padding: 1rem 1.15rem;
        background: #eff6ff;
        margin-bottom: 1rem;
      }

      .gps-box strong {
        color: var(--dark);
        font-size: 0.9rem;
      }

      .gps-text {
        margin: 0.25rem 0 0;
        font-size: 0.82rem;
        color: var(--gray);
      }

      .gps-status {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;
      }

      .filters {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1fr 160px 120px;
        align-items: end;
        margin-bottom: 0.5rem;
      }

      .layout {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 1.25rem;
        margin-top: 1rem;
      }

      .list {
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 16px;
        padding: 0.85rem;
        background: #f8fafc;
        max-height: 520px;
        overflow: auto;
      }

      .list-header {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        padding: 0 0.15rem 0.75rem;
      }

      .list-header strong {
        color: var(--dark);
      }

      .muted {
        color: var(--gray);
        font-size: 0.78rem;
      }

      .card {
        border: 1.5px solid rgba(148, 163, 184, 0.15);
        border-radius: 14px;
        padding: 0.85rem;
        background: white;
        cursor: pointer;
        display: grid;
        gap: 0.4rem;
        margin-bottom: 0.65rem;
        transition: all 0.2s;
      }

      .card:hover {
        border-color: #cbd5e1;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
      }

      .card.selected {
        border-color: var(--primary);
        background: #eff6ff;
        box-shadow: 0 4px 14px rgba(37, 99, 235, 0.1);
      }

      .row {
        display: flex;
        justify-content: space-between;
        gap: 0.65rem;
        flex-wrap: wrap;
        align-items: center;
      }

      .row strong {
        color: var(--dark);
      }

      .row.small {
        font-size: 0.78rem;
        color: var(--gray);
      }

      .pill {
        border: 1px solid rgba(148, 163, 184, 0.25);
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
        color: #475569;
        background: #f1f5f9;
      }

      .empty {
        color: var(--gray);
        font-size: 0.82rem;
        padding: 0.75rem 0.35rem;
        text-align: center;
      }

      .summary {
        display: grid;
        gap: 0.65rem;
        margin-bottom: 1rem;
      }

      .summary .item {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.85rem 1rem;
        border: 1px solid rgba(148, 163, 184, 0.15);
        border-radius: 14px;
        background: #f8fafc;
      }

      .summary span {
        color: var(--gray);
        font-size: 0.85rem;
      }

      .summary strong {
        color: var(--dark);
        font-size: 0.88rem;
      }

      @media (max-width: 980px) {
        .wizard { padding: 1rem; }
        .layout { grid-template-columns: 1fr; }
        .filters { grid-template-columns: 1fr; }
        .grid { grid-template-columns: 1fr; }
        .header { flex-direction: column; }
      }

      @media (max-width: 640px) {
        .panel { padding: 1rem; border-radius: 16px; }
        .gps-box { flex-direction: column; align-items: stretch; text-align: center; }
        .actions { flex-direction: column; }
        .btn-primary, .btn-secondary { width: 100%; text-align: center; }
      }
    `
  ]
})
export class SolicitudWizardPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(EmergencyApiService);
  private readonly router = inject(Router);
  private readonly mapbox = inject(MapboxService);

  step = signal<WizardStep>(1);
  loadError = signal<string | null>(null);
  submitError = signal<string | null>(null);

  isLoading = signal(true);
  submitting = signal(false);
  loadingTalleres = signal(false);

  clienteId = signal<number | null>(null);
  vehiculos = signal<Vehiculo[]>([]);
  tiposIncidente = signal<TipoIncidenteOption[]>([]);
  categoriasTaller = signal<CategoriaTaller[]>([]);
  talleres = signal<TallerMapa[]>([]);

  vehiculoId = signal<number | null>(null);
  tipoIncidenteId = signal<number | null>(null);
  danosDescripcion = '';
  descripcionExtra = '';
  categoriaDano = 'general';
  fechaIncidente = '';
  location = signal<LatLng | null>(null);
  requesterLocation = signal<LatLng | null>(null);
  gpsLoading = signal(false);
  gpsError = signal<string | null>(null);
  gpsConfirmedAt = signal<string | null>(null);
  ubicacionTexto = '';

  categoriaTallerId = signal<number | null>(null);
  radioKm = 25;
  selectedTallerId = signal<number | null>(null);
  presupuestoAceptado: number | null = null;

  origin = signal<LatLng | null>(null);
  private geoWatchId: number | null = null;

  vehiculoIdModel: number | null = null;
  tipoIncidenteIdModel: number | null = null;
  categoriaTallerIdModel: number | null = null;

  selectedVehiculoLabel = computed(() => {
    const id = this.vehiculoId();
    const v = this.vehiculos().find((x) => x.id === id);
    return v ? `${v.marca} ${v.modelo} (${v.placa})` : '--';
  });

  selectedTipoLabel = computed(() => {
    const id = this.tipoIncidenteId();
    const t = this.tiposIncidente().find((x) => x.id === id);
    return t ? t.nombre : '--';
  });

  selectedTallerLabel = computed(() => {
    const id = this.selectedTallerId();
    const t = this.talleres().find((x) => x.id === id);
    return t ? t.nombre : '--';
  });

  requesterLocationLabel = computed(() => {
    const value = this.requesterLocation();
    return value ? `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}` : 'Pendiente';
  });

  isBusy = computed(() => this.isLoading() || this.submitting());

  talleresForMap = computed(() => this.talleres() as unknown as TallerMapaPunto[]);

  async ngOnInit(): Promise<void> {
    this.fechaIncidente = new Date().toISOString().slice(0, 16);
    try {
      const profile = await firstValueFrom(this.api.getPerfilActual());
      const cid = profile?.cliente_id ?? null;
      this.clienteId.set(cid);
      const [vehiculos, tipos, categorias] = await Promise.all([
        firstValueFrom(this.api.getVehiculos()),
        firstValueFrom(this.api.getTiposIncidente()),
        firstValueFrom(this.api.getCategoriasTaller())
      ]);
      this.vehiculos.set(vehiculos || []);
      this.tiposIncidente.set(tipos || []);
      this.categoriasTaller.set(categorias || []);

      const firstVehiculoId = this.vehiculos()[0]?.id ?? null;
      this.vehiculoId.set(firstVehiculoId);
      this.vehiculoIdModel = firstVehiculoId;
    } catch (e: any) {
      this.loadError.set(e?.message ? String(e.message) : 'No se pudo cargar información inicial.');
    } finally {
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    if (this.geoWatchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        navigator.geolocation.clearWatch(this.geoWatchId);
      } catch {
      }
    }
    this.geoWatchId = null;
  }

  goBack(): void {
    void this.router.navigate(['/historial']);
  }

  canGoToStep2(): boolean {
    return this.canContinueFromDetails();
  }

  canGoToStep3(): boolean {
    return this.canContinueFromDetails() && this.location() != null && this.requesterLocation() != null;
  }

  canGoToStep4(): boolean {
    return this.canContinueFromDetails() && this.location() != null && this.requesterLocation() != null && this.selectedTallerId() != null;
  }

  private canContinueFromDetails(): boolean {
    const vehiculo = this.vehiculoId();
    const tipo = this.tipoIncidenteId();
    const danos = String(this.danosDescripcion || '').trim();
    const fecha = String(this.fechaIncidente || '').trim();
    return vehiculo != null && tipo != null && danos.length >= 5 && fecha.length >= 8;
  }

  nextFromDetails(): void {
    if (!this.canContinueFromDetails()) return;
    this.step.set(2);
    void this.captureRequesterLocation();
  }

  async onLocationConfirmed(pos: LatLng): Promise<void> {
    this.location.set(pos);
    try {
      const name = await this.mapbox.reverseGeocode(pos.lat, pos.lng);
      if (!this.ubicacionTexto) this.ubicacionTexto = name;
    } catch {
    }
  }

  nextFromLocation(): void {
    if (!this.location() || !this.requesterLocation()) return;
    this.origin.set(this.requesterLocation());
    this.step.set(3);
    this.ensureGeolocation();
    void this.reloadTalleres();
  }

  onCategoriaTallerChanged(id: number | null): void {
    this.categoriaTallerId.set(id);
    void this.reloadTalleres();
  }

  async reloadTalleres(): Promise<void> {
    const loc = this.location();
    if (!loc) return;
    this.loadingTalleres.set(true);
    this.submitError.set(null);
    try {
      const vehiculo = this.vehiculos().find((v) => v.id === this.vehiculoId());
      const marca = vehiculo?.marca || null;
      const items = await firstValueFrom(
        this.api.getTalleresMapa({
          categoria_id: this.categoriaTallerId(),
          dano_categoria: this.categoriaDano,
          marca,
          lat: loc.lat,
          lon: loc.lng,
          radio: this.radioKm
        })
      );
      this.talleres.set(items || []);
      if (this.selectedTallerId() != null && !this.talleres().some((t) => t.id === this.selectedTallerId())) {
        this.selectedTallerId.set(null);
      }
    } catch (e: any) {
      this.submitError.set(e?.message ? String(e.message) : 'No se pudieron cargar talleres.');
      this.talleres.set([]);
    } finally {
      this.loadingTalleres.set(false);
    }
  }

  onTallerSelected(id: number): void {
    this.selectedTallerId.set(id);
  }

  selectTaller(id: number): void {
    this.selectedTallerId.set(id);
  }

  nextFromWorkshop(): void {
    if (!this.selectedTallerId()) return;
    this.step.set(4);
  }

  async submit(): Promise<void> {
    this.submitError.set(null);
    const clienteId = this.clienteId();
    const vehiculoId = this.vehiculoId();
    const tipoId = this.tipoIncidenteId();
    const loc = this.location();
    const tallerId = this.selectedTallerId();
    const requester = this.requesterLocation();
    if (!clienteId || !vehiculoId || !tipoId || !loc || !tallerId || !requester) return;

    const danos = String(this.danosDescripcion || '').trim();
    const extra = String(this.descripcionExtra || '').trim();
    const desc = extra ? `${danos}. ${extra}` : danos;
    const fechaIso = this.fechaIncidente ? new Date(this.fechaIncidente).toISOString() : null;

    const payload: SolicitudCreatePayload = {
      cliente_id: clienteId,
      vehiculo_id: vehiculoId,
      taller_id: tallerId,
      tipo_incidente_id: tipoId,
      latitud_incidente: loc.lat,
      longitud_incidente: loc.lng,
      latitud_cliente: requester.lat,
      longitud_cliente: requester.lng,
      descripcion: desc.length >= 10 ? desc : `${desc} (detalle)`,
      danos_descripcion: danos,
      fecha_incidente: fechaIso,
      ubicacion_texto: String(this.ubicacionTexto || '').trim() || null,
      categoria_dano: this.categoriaDano
    };

    this.submitting.set(true);
    try {
      const solicitud = await firstValueFrom(this.api.createSolicitud(payload));
      if (solicitud?.id) {
        const from = this.origin() || requester;
        await firstValueFrom(
          this.api.seleccionarTallerSolicitud(solicitud.id, {
            taller_id: tallerId,
            origen_lat: from.lat,
            origen_lon: from.lng,
            presupuesto_aceptado: this.presupuestoAceptado
          })
        );
      }
      void this.router.navigate(['/historial']);
    } catch (e: any) {
      this.submitError.set(e?.message ? String(e.message) : 'No se pudo registrar la solicitud.');
    } finally {
      this.submitting.set(false);
    }
  }

  formatBs(v?: number | null): string {
    if (v == null || !Number.isFinite(v)) return '--';
    return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(v);
  }

  formatPresupuesto(t: TallerMapa): string {
    const hasDiscount = t.descuento_porcentaje_aplicado != null && (t.descuento_porcentaje_aplicado || 0) > 0;
    const minV = hasDiscount ? t.presupuesto_descuento_min : t.presupuesto_min;
    const maxV = hasDiscount ? t.presupuesto_descuento_max : t.presupuesto_max;
    return `${this.formatBs(minV)} – ${this.formatBs(maxV)}`;
  }

  private ensureGeolocation(): void {
    if (this.geoWatchId != null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    try {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = Number(pos?.coords?.latitude);
          const lng = Number(pos?.coords?.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const next = { lat, lng };
          this.origin.set(next);
          this.requesterLocation.set(next);
          this.gpsConfirmedAt.set(new Date().toISOString());
          this.gpsError.set(null);
        },
        () => {
          this.gpsError.set('No se pudo actualizar tu ubicación en tiempo real.');
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 8000 }
      );
    } catch {
    }
  }

  async captureRequesterLocation(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.gpsError.set('Tu navegador no soporta geolocalización.');
      return;
    }
    this.gpsLoading.set(true);
    this.gpsError.set(null);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000
        });
      });
      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error('No se obtuvo una ubicación válida.');
      }
      const current = { lat, lng };
      this.requesterLocation.set(current);
      this.origin.set(current);
      this.gpsConfirmedAt.set(new Date().toISOString());
      if (!this.location()) {
        await this.onLocationConfirmed(current);
      }
      this.ensureGeolocation();
    } catch (error: any) {
      this.gpsError.set(error?.message || 'Debes autorizar la geolocalización para continuar.');
    } finally {
      this.gpsLoading.set(false);
    }
  }
}
