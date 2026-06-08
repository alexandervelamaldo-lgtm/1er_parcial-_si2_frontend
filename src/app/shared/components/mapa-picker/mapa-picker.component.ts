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
import { AppIconComponent, buildInlineIconSvg, IconName } from '../app-icon/app-icon.component';

export interface IncidentePunto {
  id: number;
  estado: string;
  descripcion: string;
  latitud_incidente: number;
  longitud_incidente: number;
}

export interface TecnicoPunto {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
  disponible: boolean;
  updated_at?: string | null;
}

export interface TallerPunto {
  id: number;
  nombre: string;
  direccion?: string | null;
  lat: number;
  lng: number;
  disponible?: boolean;
  categoria?: string | null;
}

/// In-route service to draw on the map: incident → workshop polyline + ETA pill.
export interface ActiveRoute {
  solicitudId: number;
  incident: LatLng;
  workshop: LatLng;
  color?: string;            // CSS hex like "#f97316" — defaults to orange
  label?: string;            // e.g. taller name
  fallbackEtaMin?: number;   // backend ETA, shown if Mapbox call fails / is loading
}

interface ActiveRouteSummary {
  durationMin?: number;
  distanceKm?: number;
}

const SANTA_CRUZ_CENTER: LatLng = { lat: -17.7863, lng: -63.1812 };

@Component({
  selector: 'app-mapa-picker',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <div class="map-card">
      <header class="map-header">
        <div class="map-title">
          <h4><app-icon name="map" [size]="16" /> Mapa (Mapbox)</h4>
          <p class="subtitle">
            Seleccionado:
            <strong *ngIf="selected">{{ selected.lat | number:'1.4-4' }}, {{ selected.lng | number:'1.4-4' }}</strong>
            <span *ngIf="!selected">--</span>
          </p>
        </div>
        <div class="actions">
          <button class="btn-secondary" (click)="useMyLocation()" [disabled]="loadingGeo || !supportsGeo">
            {{ loadingGeo ? 'Ubicando...' : 'Usar mi ubicación' }}
          </button>
          <button class="btn-secondary" (click)="fitToAllMarkers()" [disabled]="!mapReady">Ver todos</button>
          <button class="btn-danger-light" (click)="clearCustomMarkers()" [disabled]="customMarkers.length === 0">
            Limpiar puntos
          </button>
        </div>
      </header>

      <section class="map-controls">
        <form class="search" (submit)="searchAddress($event)">
          <input
            class="input"
            name="q"
            [value]="searchText"
            (input)="searchText = ($any($event.target).value || '')"
            placeholder="Buscar dirección (Mapbox)"
            inputmode="search"
            aria-label="Buscar dirección"
          />
          <button class="btn-secondary" type="submit" [disabled]="searchLoading || searchText.trim().length === 0">
            {{ searchLoading ? 'Buscando...' : 'Buscar' }}
          </button>
          <button class="btn-primary" type="button" [disabled]="!selected" (click)="confirmSelection()">Confirmar</button>
        </form>

        <div class="details">
          <label class="field">
            <span>Dirección</span>
            <input
              class="input"
              [value]="addressText"
              (input)="addressText = ($any($event.target).value || '')"
              placeholder="Dirección (editable)"
              aria-label="Dirección seleccionada"
            />
            <small *ngIf="addressLoading">Obteniendo dirección...</small>
            <small *ngIf="addressError">{{ addressError }}</small>
          </label>

          <div class="route-panel" *ngIf="routingEnabled">
            <div class="route-title">Ruta (Mapbox Directions)</div>
            <div class="route-meta" *ngIf="routeMeta && !routeLoading">
              <span class="chip blue">{{ routeMeta.distanceKm }} km</span>
              <span class="chip blue">{{ routeMeta.durationMin }} min</span>
            </div>
            <div class="route-meta" *ngIf="routeLoading">
              <span class="chip blue">Calculando...</span>
            </div>
            <div class="route-error" *ngIf="routeError">{{ routeError }}</div>
          </div>
        </div>

        <div class="results" *ngIf="searchResults.length > 0">
          <button class="result" type="button" *ngFor="let r of searchResults" (click)="pickFromSearch(r)">
            <strong>{{ r.displayName || (r.lat | number:'1.4-4') + ', ' + (r.lng | number:'1.4-4') }}</strong>
          </button>
          <button class="btn-secondary" type="button" (click)="searchResults = []">Cerrar resultados</button>
        </div>
      </section>

      <div class="map-wrap">
        <div #mapHost class="map-host" [class.is-ready]="mapReady"></div>
        <div class="map-overlay" *ngIf="!mapReady && !loadError">
          <div class="skeleton-bar"></div>
          <div class="skeleton-box"></div>
          <p>Cargando mapa optimizado...</p>
        </div>
        <div class="map-overlay map-error" *ngIf="loadError">
          <strong>No se pudo cargar el mapa.</strong>
          <p>{{ loadError }}</p>
        </div>

        <!-- Active routes ETA strip overlay (incident → workshop services) -->
        <div class="active-routes-strip" *ngIf="activeRoutes.length > 0 && mapReady">
          <div class="ar-header">
            <app-icon name="map" [size]="14" />
            <strong>Servicios en camino · {{ activeRoutes.length }}</strong>
          </div>
          <div class="ar-list">
            <button
              *ngFor="let route of activeRoutes; trackBy: trackByRoute"
              type="button"
              class="ar-pill"
              [style.--ar-color]="activeRouteColor(route)"
              (click)="routeSelected.emit(route)"
            >
              <span class="ar-dot"></span>
              <span class="ar-label">{{ route.label || '#' + route.solicitudId }}</span>
              <span class="ar-eta">
                <ng-container *ngIf="activeRouteEta(route) as eta; else loadingEta">ETA {{ eta }} min</ng-container>
                <ng-template #loadingEta>Calculando…</ng-template>
              </span>
              <span class="ar-dist" *ngIf="activeRouteDistance(route) as dist">
                · {{ dist | number:'1.1-1' }} km
              </span>
            </button>
          </div>
        </div>
      </div>

      <footer class="map-footer">
        <div class="hint">
          <strong>Tip:</strong> toca/clic en el mapa para mover el marcador; toca un incidente para abrirlo.
        </div>
        <div class="meta">
          <span class="chip">Zoom {{ currentZoom }}</span>
          <span class="chip">{{ networkHint }}</span>
        </div>
      </footer>
    </div>
  `,
  styles: `
    .map-card { background: #ffffff; border: 1px solid #f1f5f9; border-radius: 16px; overflow: hidden; }
    .map-header { padding: 12px; display: flex; gap: 12px; align-items: center; justify-content: space-between; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap; }
    .map-title h4 { margin: 0; font-size: 1rem; color: #0f172a; display: inline-flex; align-items: center; gap: 0.45rem; }
    .subtitle { margin: 4px 0 0; color: #64748b; font-size: 0.85rem; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    button { padding: 0.65rem 1rem; border-radius: 12px; font-weight: 800; cursor: pointer; border: none; transition: 0.2s; }
    .btn-secondary { background: #f1f5f9; color: #0f172a; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-danger-light { background: #fff1f2; color: #e11d48; }
    .btn-danger-light:hover { background: #ffe4e6; }
    .btn-danger-light:disabled { opacity: 0.6; cursor: not-allowed; }

    .map-wrap { position: relative; width: 100%; }
    .map-host { width: 100%; height: clamp(280px, 45vh, 520px); }
    .map-host:not(.is-ready) { opacity: 0; }

    .map-controls { padding: 12px; border-bottom: 1px solid #f1f5f9; display: grid; gap: 10px; }
    .search { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .btn-primary { background: #2563eb; color: #ffffff; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .input { border: 1px solid #e2e8f0; border-radius: 12px; padding: 0.65rem 0.8rem; min-width: 240px; flex: 1; }
    .details { display: grid; grid-template-columns: 1fr auto; gap: 12px; align-items: start; }
    .field { display: grid; gap: 6px; color: #0f172a; }
    .field > span { font-size: 0.85rem; font-weight: 800; color: #334155; }
    .field small { color: #64748b; }
    .route-panel { padding: 10px 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; min-width: 220px; }
    .route-title { font-weight: 900; color: #0f172a; margin-bottom: 6px; }
    .route-meta { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip.blue { background: #eff6ff; color: #1d4ed8; }
    .route-error { margin-top: 6px; color: #b91c1c; font-weight: 800; }
    .results { display: grid; gap: 8px; }
    .result { text-align: left; border: 1px solid #e2e8f0; background: #ffffff; border-radius: 12px; padding: 10px 12px; }
    .result:hover { background: #f8fafc; }

    .map-overlay { position: absolute; inset: 0; padding: 16px; pointer-events: none; }
    .skeleton-bar { height: 14px; width: 240px; background: #e2e8f0; border-radius: 999px; margin-bottom: 12px; }
    .skeleton-box { width: 100%; height: clamp(240px, 40vh, 480px); background: #f1f5f9; border-radius: 14px; border: 1px solid #e2e8f0; }
    .map-overlay p { margin: 12px 0 0; color: #64748b; }

    .map-error { color: #0f172a; background: rgba(255, 255, 255, 0.98); pointer-events: auto; }
    .map-error p { margin: 8px 0 0; color: #64748b; }

    /* ── Active routes ETA strip (overlay over the bottom of the map) ─────── */
    .active-routes-strip {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      background: rgba(255, 255, 255, 0.97);
      border-radius: 14px;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.18);
      padding: 10px 12px;
      backdrop-filter: blur(6px);
      pointer-events: auto;
      display: grid;
      gap: 8px;
      max-width: 100%;
    }
    .ar-header { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #0f172a; }
    .ar-list { display: flex; gap: 8px; overflow-x: auto; padding: 2px; -webkit-overflow-scrolling: touch; }
    .ar-list::-webkit-scrollbar { height: 4px; }
    .ar-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .ar-pill {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      color: var(--ar-color, #f97316);
      background: color-mix(in srgb, var(--ar-color, #f97316) 12%, white);
      border: 1px solid color-mix(in srgb, var(--ar-color, #f97316) 35%, white);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .ar-pill:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.12);
    }
    .ar-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ar-color, #f97316);
    }
    .ar-label { font-weight: 800; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ar-eta { opacity: 0.95; }
    .ar-dist { opacity: 0.75; font-weight: 600; }

    .map-footer { padding: 12px; display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
    .hint { color: #334155; font-size: 0.9rem; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { background: #ecfeff; color: #0f766e; padding: 6px 10px; border-radius: 999px; font-weight: 800; font-size: 0.8rem; }

    :host ::ng-deep .map-marker-wrap {
      background: transparent;
      border: none;
    }

    :host ::ng-deep .map-marker {
      border-radius: 999px;
      display: grid;
      place-items: center;
      color: #ffffff;
      border: 2px solid rgba(255, 255, 255, 0.98);
      box-shadow: 0 10px 18px rgba(15, 23, 42, 0.25);
      backdrop-filter: blur(8px);
    }

    :host ::ng-deep .map-marker svg {
      display: block;
    }

    :host ::ng-deep .map-marker.incident {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }

    :host ::ng-deep .map-marker.tech {
      width: 26px;
      height: 26px;
      background: linear-gradient(135deg, #10b981, #16a34a);
    }

    :host ::ng-deep .map-marker.workshop {
      width: 26px;
      height: 26px;
      background: linear-gradient(135deg, #f59e0b, #f97316);
    }

    :host ::ng-deep .map-marker.picked {
      width: 22px;
      height: 22px;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
    }

    :host ::ng-deep .map-marker.custom {
      width: 18px;
      height: 18px;
      background: linear-gradient(135deg, #64748b, #475569);
    }

    @media (max-width: 768px) {
      .actions { width: 100%; }
      button { flex: 1; }
      .details { grid-template-columns: 1fr; }
      .route-panel { width: 100%; min-width: 0; }
      .input { min-width: 0; width: 100%; }
      .map-footer { flex-direction: column; align-items: stretch; }
      .meta { justify-content: flex-start; }
    }
  `
})
export class MapaPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapHost', { static: true }) mapHost!: ElementRef<HTMLDivElement>;

  @Input({ required: true }) incidentPoints: IncidentePunto[] = [];
  @Input() technicians: TecnicoPunto[] = [];
  @Input() workshops: TallerPunto[] = [];
  @Input() unitLocation: LatLng | null = null;
  /// Active "incident → workshop" services to draw on the map with ETA pills.
  @Input() activeRoutes: ActiveRoute[] = [];
  @Output() incidentSelected = new EventEmitter<number>();
  @Output() locationSelected = new EventEmitter<LatLng>();
  @Output() locationConfirmed = new EventEmitter<LatLng>();
  @Output() selectionDetails = new EventEmitter<{ location: LatLng; address: string }>();
  @Output() routeSelected = new EventEmitter<ActiveRoute>();

  selected: LatLng | null = null;
  currentZoom = 13;
  loadingGeo = false;
  supportsGeo = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  loadError: string | null = null;
  mapReady = false;
  networkHint = this._computeNetworkHint();

  addressText = '';
  addressLoading = false;
  addressError: string | null = null;

  searchText = '';
  searchLoading = false;
  searchResults: Array<{ lat: number; lng: number; displayName: string }> = [];

  routingEnabled = false;
  routeLoading = false;
  routeError: string | null = null;
  routeMeta: { distanceKm: number; durationMin: number } | null = null;

  customMarkers: any[] = [];

  private mapboxgl: any;
  private map: any;
  private pickedMarker: any;
  private routeTimer: number | null = null;
  private reverseTimer: number | null = null;
  private reverseAbort?: AbortController;
  private searchAbort?: AbortController;
  private routeAbort?: AbortController;
  private incidentMarkers = new Map<number, any>();
  private technicianMarkers = new Map<number, any>();
  private workshopMarkers = new Map<number, any>();
  private activeRouteMarkers = new Map<number, any>();          // workshop pins for active routes
  private activeRouteSummaries = new Map<number, ActiveRouteSummary>();
  private activeRouteSerial = 0;
  private intersectionObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private readonly routeSourceId = 'picker-route-source';
  private readonly routeLayerId = 'picker-route-layer';
  private readonly activeRoutesSourceId = 'picker-active-routes-source';
  private readonly activeRoutesLayerId = 'picker-active-routes-layer';

  constructor(private readonly mapbox: MapboxService) {}

  ngAfterViewInit(): void {
    const container = this.mapHost?.nativeElement;
    if (!container) {
      this.loadError = 'Contenedor del mapa no disponible.';
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        if (visible) {
          void this._initMap();
          this.intersectionObserver?.disconnect();
          this.intersectionObserver = undefined;
        }
      },
      { root: null, threshold: 0.15 }
    );
    this.intersectionObserver.observe(container);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.mapReady) return;
    if (changes['incidentPoints']) {
      this._syncIncidentMarkers();
    }
    if (changes['technicians']) {
      this._syncTechnicianMarkers();
    }
    if (changes['workshops']) {
      this._syncWorkshopMarkers();
    }
    if (changes['unitLocation']) {
      this._refreshRoute(true);
    }
    if (changes['activeRoutes']) {
      void this._syncActiveRoutes();
    }
  }

  ngOnDestroy(): void {
    if (this.reverseTimer) window.clearTimeout(this.reverseTimer);
    if (this.routeTimer) window.clearInterval(this.routeTimer);
    this.reverseAbort?.abort();
    this.searchAbort?.abort();
    this.routeAbort?.abort();
    try {
      this.resizeObserver?.disconnect();
      this.intersectionObserver?.disconnect();
    } catch (_) {}
    try {
      this.map?.off?.();
      this.map?.remove?.();
    } catch (_) {}
    this.map = undefined;
    this.pickedMarker = undefined;
    this.incidentMarkers.clear();
    this.technicianMarkers.clear();
    this.workshopMarkers.clear();
    this.activeRouteMarkers.clear();
    this.activeRouteSummaries.clear();
  }

  async useMyLocation(): Promise<void> {
    if (!this.supportsGeo || this.loadingGeo) return;

    const accepted = window.confirm(
      'Usar tu ubicación ayuda a seleccionar un punto con mayor precisión.\n\n¿Querés permitir el acceso a la ubicación?'
    );
    if (!accepted) return;

    this.loadingGeo = true;
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          maximumAge: 30_000,
          timeout: 10_000
        });
      });
      const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
      this._applySelection(loc, true);
      this._setView(loc, Math.max(this.currentZoom, 14));
      this._persistCustomMarkers();
    } catch (err: any) {
      const message =
        typeof err?.message === 'string' && err.message.length > 0
          ? err.message
          : 'No se pudo obtener la ubicación.';
      this.loadError = message;
    } finally {
      this.loadingGeo = false;
    }
  }

  selectLocation(lat: number, lng: number): void {
    const safeLat = Number(lat);
    const safeLng = Number(lng);
    if (!Number.isFinite(safeLat) || !Number.isFinite(safeLng)) return;
    this._applySelection({ lat: safeLat, lng: safeLng }, true);
    this._reverseGeocodeDebounced();
    this._refreshRoute(false);
    this._persistCustomMarkers();
  }

  confirmSelection(): void {
    if (!this.selected) return;
    this.locationConfirmed.emit(this.selected);
    this.selectionDetails.emit({ location: this.selected, address: this.addressText.trim() });
  }

  async searchAddress(ev: Event): Promise<void> {
    ev.preventDefault();
    const q = String(this.searchText || '').trim();
    if (!q) return;
    this.searchAbort?.abort();
    const ac = new AbortController();
    this.searchAbort = ac;
    this.searchLoading = true;
    this.searchResults = [];
    try {
      this.searchResults = await this.mapbox.search(q, ac.signal);
    } catch (err: any) {
      this.loadError = typeof err?.message === 'string' ? err.message : 'No se pudo buscar la dirección.';
    } finally {
      this.searchLoading = false;
    }
  }

  pickFromSearch(r: { lat: number; lng: number; displayName: string }): void {
    this.searchResults = [];
    this.selectLocation(r.lat, r.lng);
    this._setView({ lat: r.lat, lng: r.lng }, Math.max(this.currentZoom, 14));
  }

  fitToAllMarkers(): void {
    if (!this.mapReady || !this.map || !this.mapboxgl) return;

    const points: Array<[number, number]> = [];
    for (const m of this.incidentMarkers.values()) {
      const ll = m?.getLngLat?.();
      if (ll) points.push([ll.lng, ll.lat]);
    }
    for (const m of this.technicianMarkers.values()) {
      const ll = m?.getLngLat?.();
      if (ll) points.push([ll.lng, ll.lat]);
    }
    for (const m of this.customMarkers) {
      const ll = m?.getLngLat?.();
      if (ll) points.push([ll.lng, ll.lat]);
    }
    for (const m of this.workshopMarkers.values()) {
      const ll = m?.getLngLat?.();
      if (ll) points.push([ll.lng, ll.lat]);
    }
    if (this.pickedMarker?.getLngLat) {
      const ll = this.pickedMarker.getLngLat();
      points.push([ll.lng, ll.lat]);
    }
    if (points.length === 0) {
      this._setView(SANTA_CRUZ_CENTER, 13);
      return;
    }
    const bounds = points.reduce((acc, point) => acc.extend(point), new this.mapboxgl.LngLatBounds());
    this.map.fitBounds(bounds, { padding: 32, duration: 500 });
    this.currentZoom = Math.round(this.map.getZoom?.() ?? this.currentZoom);
  }

  clearCustomMarkers(): void {
    for (const marker of this.customMarkers) {
      try {
        marker.remove?.();
      } catch (_) {}
    }
    this.customMarkers = [];
    localStorage.removeItem('mapbox.customMarkers');
  }

  private async _initMap(): Promise<void> {
    if (this.mapReady || this.map) return;
    const container = this.mapHost?.nativeElement;
    if (!container) {
      this.loadError = 'Contenedor del mapa no disponible.';
      return;
    }

    try {
      this.mapboxgl = await this.mapbox.loadMapboxGl();
    } catch (err: any) {
      this.loadError = 'No se pudo cargar Mapbox GL.';
      return;
    }

    try {
      this.map = new this.mapboxgl.Map({
        container,
        style: await this.mapbox.getStyleUrl(),
        center: [SANTA_CRUZ_CENTER.lng, SANTA_CRUZ_CENTER.lat],
        zoom: 13,
      });
      this.map.addControl(new this.mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
      this.map.on('click', (e: any) => {
        const lat = Number(e?.lngLat?.lat);
        const lng = Number(e?.lngLat?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        this.selectLocation(lat, lng);
      });

      this.map.on('zoomend', () => {
        this.currentZoom = Math.round(this.map.getZoom?.() ?? this.currentZoom);
      });

      this.resizeObserver = new ResizeObserver(() => {
        try {
          this.map?.resize?.();
        } catch (_) {}
      });
      this.resizeObserver.observe(container);

      this.map.on('load', () => {
        this.currentZoom = Math.round(this.map.getZoom?.() ?? 13);
        this._restoreCustomMarkers();
        this._syncIncidentMarkers();
        this._syncTechnicianMarkers();
        this._syncWorkshopMarkers();
        void this._syncActiveRoutes();
        this._reverseGeocodeDebounced();
        this._refreshRoute(true);
        this.mapReady = true;
        this.loadError = null;
        setTimeout(() => {
          try {
            this.map?.resize?.();
          } catch (_) {}
        }, 0);
      });
    } catch (err: any) {
      this.loadError = 'Falló la inicialización del mapa.';
      return;
    }
  }

  private _applySelection(loc: LatLng, createCustom: boolean): void {
    this.selected = loc;
    this.locationSelected.emit(loc);
    if (!this.map || !this.mapboxgl) return;

    if (!this.pickedMarker) {
      const element = document.createElement('div');
      element.className = 'map-marker-wrap';
      element.innerHTML = this._buildMarkerHtml('pin', 'picked');
      this.pickedMarker = new this.mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([loc.lng, loc.lat])
        .addTo(this.map);
    } else {
      this.pickedMarker.setLngLat([loc.lng, loc.lat]);
    }

    if (createCustom) {
      const element = document.createElement('div');
      element.className = 'map-marker-wrap';
      element.innerHTML = this._buildMarkerHtml('pin', 'custom');
      const m = new this.mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([loc.lng, loc.lat])
        .addTo(this.map);
      this.customMarkers.push(m);
    }
  }

  private _reverseGeocodeDebounced(): void {
    if (!this.selected) return;
    if (this.reverseTimer) window.clearTimeout(this.reverseTimer);
    this.reverseTimer = window.setTimeout(() => void this._reverseGeocodeNow(), 650);
  }

  private async _reverseGeocodeNow(): Promise<void> {
    if (!this.selected) return;
    this.reverseAbort?.abort();
    const ac = new AbortController();
    this.reverseAbort = ac;
    this.addressLoading = true;
    this.addressError = null;
    try {
      const name = await this.mapbox.reverseGeocode(this.selected.lat, this.selected.lng, ac.signal);
      this.addressText = name;
    } catch (err: any) {
      this.addressError = typeof err?.message === 'string' ? err.message : 'No se pudo obtener la dirección.';
    } finally {
      this.addressLoading = false;
    }
  }

  private _refreshRoute(forceTimerReset: boolean): void {
    const has = !!(this.mapReady && this.map && this.selected && this.unitLocation);
    this.routingEnabled = has;
    if (!has) {
      this.routeError = null;
      this.routeMeta = null;
      this.routeLoading = false;
      this._clearRouteLayer();
      if (this.routeTimer) window.clearInterval(this.routeTimer);
      this.routeTimer = null;
      return;
    }

    if (forceTimerReset) {
      if (this.routeTimer) window.clearInterval(this.routeTimer);
      this.routeTimer = window.setInterval(() => void this._fetchAndDrawRoute(), 30000);
    }
    void this._fetchAndDrawRoute();
  }

  private async _fetchAndDrawRoute(): Promise<void> {
    if (!this.map || !this.selected || !this.unitLocation) return;
    this.routeAbort?.abort();
    const ac = new AbortController();
    this.routeAbort = ac;
    this.routeLoading = true;
    this.routeError = null;
    try {
      const data = await this.mapbox.route(this.unitLocation, this.selected, ac.signal);
      this.routeMeta = { distanceKm: data.distanceKm, durationMin: data.durationMin };
      this._drawRouteLayer(data.coords);
    } catch (err: any) {
      this.routeMeta = null;
      this.routeError = typeof err?.message === 'string' ? err.message : 'No se pudo calcular la ruta.';
      this._clearRouteLayer();
    } finally {
      this.routeLoading = false;
    }
  }

  private _setView(center: LatLng, zoom: number): void {
    if (!this.map) return;
    this.map.easeTo({ center: [center.lng, center.lat], zoom, duration: 500 });
    this.currentZoom = Math.round(this.map.getZoom?.() ?? this.currentZoom);
  }

  private _syncIncidentMarkers(): void {
    if (!this.map || !this.mapboxgl) return;

    const nextIds = new Set<number>();
    for (const p of this.incidentPoints || []) {
      nextIds.add(p.id);
      const lat = Number(p.latitud_incidente);
      const lng = Number(p.longitud_incidente);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const existing = this.incidentMarkers.get(p.id);
      if (existing) {
        existing.setLngLat([lng, lat]);
        continue;
      }

      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'map-marker-wrap';
      element.innerHTML = this._buildMarkerHtml('alert', 'incident');
      element.addEventListener('click', () => this.incidentSelected.emit(p.id));
      const marker = new this.mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([lng, lat])
        .setPopup(new this.mapboxgl.Popup({ offset: 18 }).setHTML(`<strong>#${p.id}</strong><br/>${this._escapeHtml(p.descripcion || '')}`))
        .addTo(this.map);
      this.incidentMarkers.set(p.id, marker);
    }

    for (const [id, marker] of Array.from(this.incidentMarkers.entries())) {
      if (!nextIds.has(id)) {
        try {
          marker.remove?.();
        } catch (_) {}
        this.incidentMarkers.delete(id);
      }
    }
  }

  private _syncTechnicianMarkers(): void {
    if (!this.map || !this.mapboxgl) return;

    const nextIds = new Set<number>();
    for (const t of this.technicians || []) {
      nextIds.add(t.id);
      const lat = Number(t.lat);
      const lng = Number(t.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const existing = this.technicianMarkers.get(t.id);
      if (existing) {
        existing.setLngLat([lng, lat]);
        continue;
      }

      const element = document.createElement('div');
      element.className = 'map-marker-wrap';
      element.innerHTML = this._buildMarkerHtml('car', 'tech');
      const marker = new this.mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([lng, lat])
        .setPopup(new this.mapboxgl.Popup({ offset: 18 }).setHTML(`<strong>${this._escapeHtml(t.nombre || 'Taller')}</strong>`))
        .addTo(this.map);
      this.technicianMarkers.set(t.id, marker);
    }

    for (const [id, marker] of Array.from(this.technicianMarkers.entries())) {
      if (!nextIds.has(id)) {
        try {
          marker.remove?.();
        } catch (_) {}
        this.technicianMarkers.delete(id);
      }
    }
  }

  private _syncWorkshopMarkers(): void {
    if (!this.map || !this.mapboxgl) return;

    const nextIds = new Set<number>();
    for (const workshop of this.workshops || []) {
      nextIds.add(workshop.id);
      const lat = Number(workshop.lat);
      const lng = Number(workshop.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const existing = this.workshopMarkers.get(workshop.id);
      if (existing) {
        existing.setLngLat([lng, lat]);
        continue;
      }

      const element = document.createElement('div');
      element.className = 'map-marker-wrap';
      element.innerHTML = this._buildMarkerHtml('wrench', 'workshop');
      const marker = new this.mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([lng, lat])
        .setPopup(
          new this.mapboxgl.Popup({ offset: 18 }).setHTML(
            `<strong>${this._escapeHtml(workshop.nombre || 'Taller')}</strong><br/>` +
              `${this._escapeHtml(workshop.direccion || '')}` +
              `${workshop.categoria ? `<br/><small>${this._escapeHtml(workshop.categoria)}</small>` : ''}`
          )
        )
        .addTo(this.map);
      this.workshopMarkers.set(workshop.id, marker);
    }

    for (const [id, marker] of Array.from(this.workshopMarkers.entries())) {
      if (!nextIds.has(id)) {
        try {
          marker.remove?.();
        } catch (_) {}
        this.workshopMarkers.delete(id);
      }
    }
  }

  private _restoreCustomMarkers(): void {
    if (!this.map || !this.mapboxgl) return;
    const raw = localStorage.getItem('mapbox.customMarkers');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Array<{ lat: number; lng: number }>;
      if (!Array.isArray(parsed)) return;
      for (const item of parsed) {
        const lat = Number(item?.lat);
        const lng = Number(item?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const element = document.createElement('div');
        element.className = 'map-marker-wrap';
        element.innerHTML = this._buildMarkerHtml('pin', 'custom');
        const m = new this.mapboxgl.Marker({ element, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(this.map);
        this.customMarkers.push(m);
      }
    } catch (_) {}
  }

  private _buildMarkerHtml(icon: IconName, variant: 'incident' | 'tech' | 'workshop' | 'picked' | 'custom'): string {
    const size = variant === 'incident' ? 12 : variant === 'custom' ? 9 : 11;
    const strokeWidth = variant === 'custom' ? 2.2 : 2;
    return `<div class="map-marker ${variant}">${buildInlineIconSvg(icon, { size, strokeWidth, className: 'map-marker-svg' })}</div>`;
  }

  private _persistCustomMarkers(): void {
    const data = this.customMarkers
      .map((m) => m?.getLngLat?.())
      .filter(Boolean)
      .map((ll: any) => ({ lat: Number(ll.lat), lng: Number(ll.lng) }))
      .filter((ll) => Number.isFinite(ll.lat) && Number.isFinite(ll.lng));
    try {
      localStorage.setItem('mapbox.customMarkers', JSON.stringify(data));
    } catch (_) {}
  }

  private _drawRouteLayer(coords: Array<[number, number]>): void {
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
        'line-width': 6,
        'line-opacity': 0.9
      }
    });
  }

  private _clearRouteLayer(): void {
    try {
      if (this.map?.getLayer?.(this.routeLayerId)) {
        this.map.removeLayer(this.routeLayerId);
      }
      if (this.map?.getSource?.(this.routeSourceId)) {
        this.map.removeSource(this.routeSourceId);
      }
    } catch (_) {}
  }

  // ── Active routes (incident → workshop) ───────────────────────────────────

  /// Returns the live ETA for the given solicitudId, preferring real driving
  /// time computed by Mapbox, falling back to the backend's `fallbackEtaMin`.
  activeRouteEta(route: ActiveRoute): number | null {
    return this.activeRouteSummaries.get(route.solicitudId)?.durationMin ?? route.fallbackEtaMin ?? null;
  }

  /// Returns the live distance (km) computed by Mapbox for the given route.
  activeRouteDistance(route: ActiveRoute): number | null {
    return this.activeRouteSummaries.get(route.solicitudId)?.distanceKm ?? null;
  }

  /// CSS color string (with fallback to orange) for a given route.
  activeRouteColor(route: ActiveRoute): string {
    const raw = (route.color || '').trim();
    return /^#?[0-9a-fA-F]{6}$/.test(raw) ? (raw.startsWith('#') ? raw : `#${raw}`) : '#f97316';
  }

  /// Track-by helper for the *ngFor pill list to avoid full re-renders.
  trackByRoute = (_: number, r: ActiveRoute) => r.solicitudId;

  private async _syncActiveRoutes(): Promise<void> {
    if (!this.map || !this.mapboxgl) return;
    const serial = ++this.activeRouteSerial;

    // Clear existing workshop pins
    for (const marker of this.activeRouteMarkers.values()) {
      try { marker.remove?.(); } catch (_) {}
    }
    this.activeRouteMarkers.clear();
    this._clearActiveRoutesLayer();

    const routes = this.activeRoutes || [];
    if (routes.length === 0) {
      if (this.activeRouteSummaries.size > 0) this.activeRouteSummaries.clear();
      return;
    }

    // Add workshop pins for each active route (orange wrench)
    for (const route of routes) {
      const element = document.createElement('div');
      element.className = 'map-marker-wrap';
      element.innerHTML = this._buildMarkerHtml('wrench', 'workshop');
      element.title = route.label || `Solicitud #${route.solicitudId}`;
      const marker = new this.mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([route.workshop.lng, route.workshop.lat])
        .addTo(this.map);
      this.activeRouteMarkers.set(route.solicitudId, marker);
    }

    // Immediately draw straight placeholder lines so user sees them while
    // the real driving paths are fetched in parallel.
    this._drawActiveRoutesLayer(
      routes.map((r) => ({
        coords: [
          [r.incident.lng, r.incident.lat],
          [r.workshop.lng, r.workshop.lat]
        ],
        color: this.activeRouteColor(r),
        solicitudId: r.solicitudId,
        opacity: 0.45,
        width: 3
      }))
    );

    // Fetch real routes in parallel
    const results = await Promise.all(
      routes.map(async (route) => {
        try {
          const data = await this.mapbox.route(route.incident, route.workshop);
          return { route, data };
        } catch (_) {
          return { route, data: null as null | { coords: Array<[number, number]>; distanceKm: number; durationMin: number } };
        }
      })
    );

    if (serial !== this.activeRouteSerial) return;

    // Replace placeholders with the real polylines + update summaries
    const features: Array<{
      coords: Array<[number, number]>;
      color: string;
      solicitudId: number;
      opacity: number;
      width: number;
    }> = [];
    this.activeRouteSummaries.clear();
    for (const { route, data } of results) {
      const color = this.activeRouteColor(route);
      if (data) {
        // mapbox.route returns coords as [lat, lng] pairs — convert to [lng, lat] here
        features.push({
          coords: data.coords.map(([lat, lng]) => [lng, lat] as [number, number]),
          color,
          solicitudId: route.solicitudId,
          opacity: 0.9,
          width: 5
        });
        this.activeRouteSummaries.set(route.solicitudId, {
          durationMin: data.durationMin,
          distanceKm: data.distanceKm
        });
      } else {
        features.push({
          coords: [
            [route.incident.lng, route.incident.lat],
            [route.workshop.lng, route.workshop.lat]
          ],
          color,
          solicitudId: route.solicitudId,
          opacity: 0.6,
          width: 3
        });
        if (route.fallbackEtaMin != null) {
          this.activeRouteSummaries.set(route.solicitudId, { durationMin: route.fallbackEtaMin });
        }
      }
    }
    this._drawActiveRoutesLayer(features);
  }

  private _drawActiveRoutesLayer(
    features: Array<{ coords: Array<[number, number]>; color: string; solicitudId: number; opacity: number; width: number }>
  ): void {
    if (!this.map) return;
    const geojson = {
      type: 'FeatureCollection',
      features: features.map((f) => ({
        type: 'Feature',
        properties: {
          color: f.color,
          opacity: f.opacity,
          width: f.width,
          solicitudId: f.solicitudId
        },
        geometry: {
          type: 'LineString',
          coordinates: f.coords
        }
      }))
    };
    const source = this.map.getSource(this.activeRoutesSourceId);
    if (source) {
      source.setData(geojson);
      return;
    }
    this.map.addSource(this.activeRoutesSourceId, { type: 'geojson', data: geojson });
    this.map.addLayer({
      id: this.activeRoutesLayerId,
      type: 'line',
      source: this.activeRoutesSourceId,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity']
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      }
    });
  }

  private _clearActiveRoutesLayer(): void {
    try {
      if (this.map?.getLayer?.(this.activeRoutesLayerId)) {
        this.map.removeLayer(this.activeRoutesLayerId);
      }
      if (this.map?.getSource?.(this.activeRoutesSourceId)) {
        this.map.removeSource(this.activeRoutesSourceId);
      }
    } catch (_) {}
  }

  private _computeNetworkHint(): string {
    const nav = navigator as any;
    const type = String(nav?.connection?.effectiveType || '').toLowerCase();
    if (type === 'slow-2g') return 'Optimizado para red lenta';
    if (type === '2g') return 'Optimizado para 2G';
    if (type === '3g') return 'Optimizado para 3G';
    return 'Optimizado para móvil';
  }

  private _escapeHtml(value: string): string {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}

