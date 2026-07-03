import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { LatLng, MapboxService } from '../../../core/services/mapa/mapbox.service';
import { AppIconComponent, buildInlineIconSvg } from '../app-icon/app-icon.component';

export interface TallerMapaPunto {
  id: number;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono: string;
  horarios?: string | null;
  certificaciones?: string | null;
  rating_promedio?: number;
  rating_total?: number;
  categoria?: { id: number; slug: string; nombre: string } | null;
  distancia_km?: number | null;
  presupuesto_min?: number | null;
  presupuesto_max?: number | null;
  presupuesto_descuento_min?: number | null;
  presupuesto_descuento_max?: number | null;
  descuento_porcentaje_aplicado?: number | null;
  tiempo_reparacion_horas?: number | null;
}

const SANTA_CRUZ_CENTER: LatLng = { lat: -17.7863, lng: -63.1812 };

function escapeHtml(value: string): string {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatBs(v?: number | null): string {
  if (v == null || !Number.isFinite(v)) return '--';
  return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(v);
}

@Component({
  selector: 'app-talleres-mapa-selector',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <section class="map-card">
      <header class="map-header">
        <div class="title">
          <h4><app-icon name="wrench" [size]="16" /> Talleres disponibles</h4>
          <p class="meta">
            <span>{{ talleres.length || 0 }} talleres</span>
            <span *ngIf="selectedTaller">Seleccionado: <strong>{{ selectedTaller.nombre }}</strong></span>
          </p>
        </div>
        <div class="actions">
          <button class="btn-secondary" (click)="fitToWorkshops()" [disabled]="!mapReady || (talleres.length || 0) === 0">
            Ver todos
          </button>
        </div>
      </header>

      <div class="map-host" #mapHost></div>

      <div class="route-panel" *ngIf="routeMeta || routeError || routeLoading">
        <div class="row">
          <strong>Ruta</strong>
          <span class="muted" *ngIf="routeLoading">Calculando…</span>
        </div>
        <div class="row" *ngIf="routeMeta">
          <span>Distancia: <strong>{{ routeMeta.distanceKm | number:'1.0-2' }} km</strong></span>
          <span>ETA: <strong>{{ routeMeta.durationMin }} min</strong></span>
        </div>
        <div class="error" *ngIf="routeError">{{ routeError }}</div>
      </div>
    </section>
  `,
  styles: [
    `
      .map-card {
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 14px;
        overflow: hidden;
        background: rgba(15, 23, 42, 0.6);
      }

      .map-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      }

      .title h4 {
        margin: 0;
        font-size: 14px;
        letter-spacing: 0.3px;
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
      }

      .meta {
        margin: 4px 0 0;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        color: rgba(226, 232, 240, 0.82);
        font-size: 12px;
      }

      .actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }

      .btn-secondary {
        border: 1px solid rgba(148, 163, 184, 0.35);
        background: rgba(2, 6, 23, 0.35);
        color: rgba(226, 232, 240, 0.9);
        border-radius: 10px;
        padding: 8px 10px;
        cursor: pointer;
        font-size: 12px;
      }
      .btn-secondary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .map-host {
        height: 420px;
        width: 100%;
      }

      :host ::ng-deep .workshop-marker-wrap {
        background: transparent;
        border: none;
      }

      :host ::ng-deep .workshop-marker {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #f59e0b, #f97316);
        color: #ffffff;
        border: 2px solid rgba(255, 255, 255, 0.96);
        box-shadow: 0 10px 18px rgba(15, 23, 42, 0.28);
      }

      :host ::ng-deep .workshop-marker-svg {
        display: block;
      }

      .route-panel {
        position: relative;
        padding: 10px 14px 14px;
        border-top: 1px solid rgba(148, 163, 184, 0.18);
        color: rgba(226, 232, 240, 0.95);
        font-size: 12px;
      }

      .row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }

      .muted {
        color: rgba(226, 232, 240, 0.7);
      }

      .error {
        margin-top: 8px;
        color: #fecaca;
      }

      @media (max-width: 768px) {
        .map-host {
          height: 360px;
        }
      }
    `
  ]
})
export class TalleresMapaSelectorComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapHost', { static: true }) mapHost!: ElementRef<HTMLDivElement>;

  @Input() talleres: TallerMapaPunto[] = [];
  @Input() origin: LatLng | null = null;
  @Input() selectedTallerId: number | null = null;
  @Output() tallerSelected = new EventEmitter<number>();

  mapReady = false;
  routeLoading = false;
  routeError: string | null = null;
  routeMeta: { distanceKm: number; durationMin: number } | null = null;

  get selectedTaller(): TallerMapaPunto | null {
    const id = this.selectedTallerId;
    if (!id) return null;
    return this.talleres.find((t) => t.id === id) || null;
  }

  private mapboxgl: any;
  private map: any;
  private markers = new Map<number, any>();
  private routeTimer: number | null = null;
  private routeAbort?: AbortController;
  private readonly routeSourceId = 'workshop-route-source';
  private readonly routeLayerId = 'workshop-route-layer';

  constructor(private readonly mapbox: MapboxService) {}

  ngAfterViewInit(): void {
    void this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.mapReady) return;
    if (changes['talleres']) {
      this.syncMarkers();
    }
    if (changes['selectedTallerId']) {
      this.highlightSelected();
      void this.refreshRoute();
    }
    if (changes['origin']) {
      void this.refreshRoute();
    }
  }

  ngOnDestroy(): void {
    if (this.routeTimer) {
      window.clearInterval(this.routeTimer);
      this.routeTimer = null;
    }
    this.routeAbort?.abort();
    this.routeAbort = undefined;
    for (const marker of this.markers.values()) {
      try {
        marker.remove?.();
      } catch {
      }
    }
    try {
      this.map?.remove?.();
    } catch {
    }
    this.mapReady = false;
  }

  fitToWorkshops(): void {
    if (!this.mapReady) return;
    const pts = this.talleres.map((t) => [t.longitud, t.latitud] as [number, number]);
    if (!pts.length) {
      this.map.easeTo({ center: [SANTA_CRUZ_CENTER.lng, SANTA_CRUZ_CENTER.lat], zoom: 13, duration: 500 });
      return;
    }
    const bounds = pts.reduce((acc, point) => acc.extend(point), new this.mapboxgl.LngLatBounds());
    this.map.fitBounds(bounds, { padding: 48, duration: 500 });
  }

  private async initMap(): Promise<void> {
    const container = this.mapHost?.nativeElement;
    if (!container) return;
    this.mapboxgl = await this.mapbox.loadMapboxGl();
    const styleUrl = await this.mapbox.getStyleUrl();
    container.innerHTML = '';

    this.map = new this.mapboxgl.Map({
      container,
      style: styleUrl,
      center: [SANTA_CRUZ_CENTER.lng, SANTA_CRUZ_CENTER.lat],
      zoom: 13,
    });
    this.map.addControl(new this.mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    this.map.on('load', () => {
      this.mapReady = true;
      this.syncMarkers();
      this.highlightSelected();
      this.fitToWorkshops();
      void this.refreshRoute();
    });

    this.routeTimer = window.setInterval(() => {
      void this.refreshRoute();
    }, 30000);
  }

  private syncMarkers(): void {
    if (!this.mapReady) return;

    const currentIds = new Set(this.talleres.map((t) => t.id));
    for (const [id, marker] of this.markers.entries()) {
      if (!currentIds.has(id)) {
        try {
          marker.remove?.();
        } catch {
        }
        this.markers.delete(id);
      }
    }

    for (const t of this.talleres) {
      if (this.markers.has(t.id)) continue;
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'workshop-marker-wrap';
      element.innerHTML = `<div class="workshop-marker">${buildInlineIconSvg('wrench', { size: 12, strokeWidth: 2.1, className: 'workshop-marker-svg' })}</div>`;
      element.addEventListener('click', () => {
        this.selectedTallerId = t.id;
        this.tallerSelected.emit(t.id);
        this.highlightSelected();
        void this.refreshRoute();
      });

      const marker = new this.mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([t.longitud, t.latitud])
        .setPopup(new this.mapboxgl.Popup({ maxWidth: '280px', offset: 18 }).setHTML(this.buildPopupHtml(t)))
        .addTo(this.map);
      this.markers.set(t.id, marker);
    }
  }

  private highlightSelected(): void {
    if (!this.mapReady) return;
    for (const [id, marker] of this.markers.entries()) {
      const isSelected = this.selectedTallerId != null && id === this.selectedTallerId;
      try {
        marker.getElement()?.style.setProperty('transform', isSelected ? 'scale(1.08)' : 'scale(1)');
      } catch {
      }
      if (isSelected) {
        try {
          marker.openPopup();
        } catch {
        }
      }
    }
  }

  private buildPopupHtml(t: TallerMapaPunto): string {
    const cat = t.categoria?.nombre ? escapeHtml(t.categoria.nombre) : '—';
    const dist = t.distancia_km != null ? `${Number(t.distancia_km).toFixed(2)} km` : '—';
    const rating =
      t.rating_promedio != null && Number.isFinite(t.rating_promedio)
        ? `${Number(t.rating_promedio).toFixed(1)} (${t.rating_total || 0})`
        : '—';
    const hasDiscount = t.descuento_porcentaje_aplicado != null && (t.descuento_porcentaje_aplicado || 0) > 0;
    const presMin = formatBs(hasDiscount ? t.presupuesto_descuento_min : t.presupuesto_min);
    const presMax = formatBs(hasDiscount ? t.presupuesto_descuento_max : t.presupuesto_max);
    const horas = t.tiempo_reparacion_horas != null ? `${Number(t.tiempo_reparacion_horas).toFixed(1)} h` : '—';
    const discountLabel = hasDiscount ? ` (-${Number(t.descuento_porcentaje_aplicado).toFixed(0)}%)` : '';

    return `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; line-height: 1.25;">
        <div style="font-weight: 700; margin-bottom: 4px;">${escapeHtml(t.nombre)}</div>
        <div style="font-size: 12px; margin-bottom: 8px; color: #0f172a;">
          <div><strong>Categoría:</strong> ${cat}</div>
          <div><strong>Distancia:</strong> ${dist}</div>
          <div><strong>Rating:</strong> ${rating}</div>
        </div>
        <div style="font-size: 12px; margin-bottom: 8px; color: #0f172a;">
          <div><strong>Presupuesto:</strong> ${presMin} – ${presMax}${discountLabel}</div>
          <div><strong>Tiempo:</strong> ${horas}</div>
        </div>
        <div style="font-size: 12px; color: #0f172a;">
          <div><strong>Dirección:</strong> ${escapeHtml(t.direccion)}</div>
          <div><strong>Contacto:</strong> ${escapeHtml(t.telefono)}</div>
        </div>
      </div>
    `;
  }

  private async refreshRoute(): Promise<void> {
    if (!this.mapReady) return;
    const origin = this.origin;
    const taller = this.selectedTaller;
    if (!origin || !taller) {
      this.clearRoute();
      return;
    }

    this.routeAbort?.abort();
    this.routeAbort = new AbortController();
    this.routeLoading = true;
    this.routeError = null;

    try {
      const res = await this.mapbox.route(origin, { lat: taller.latitud, lng: taller.longitud }, this.routeAbort.signal);
      this.routeMeta = { distanceKm: res.distanceKm, durationMin: res.durationMin };
      this.drawRoute(res.coords);
    } catch (e: any) {
      if (String(e?.name || '') === 'AbortError') return;
      this.routeError = e?.message ? String(e.message) : 'No se pudo calcular la ruta.';
      this.routeMeta = null;
      this.clearRoute();
    } finally {
      this.routeLoading = false;
    }
  }

  private drawRoute(coords: Array<[number, number]>): void {
    if (!this.mapReady) return;
    const data = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords.map(([lat, lng]) => [lng, lat])
      }
    };
    const source = this.map.getSource(this.routeSourceId);
    if (source) {
      source.setData(data);
      return;
    }
    this.map.addSource(this.routeSourceId, { type: 'geojson', data });
    this.map.addLayer({
      id: this.routeLayerId,
      type: 'line',
      source: this.routeSourceId,
      paint: {
        'line-color': '#2563eb',
        'line-width': 5,
        'line-opacity': 0.9
      }
    });
  }

  private clearRoute(): void {
    try {
      if (this.map?.getLayer?.(this.routeLayerId)) {
        this.map.removeLayer(this.routeLayerId);
      }
      if (this.map?.getSource?.(this.routeSourceId)) {
        this.map.removeSource(this.routeSourceId);
      }
    } catch {
    }
    this.routeMeta = null;
  }
}

