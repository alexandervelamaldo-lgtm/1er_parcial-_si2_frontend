import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';

import { LatLng, MapboxService } from '../../../core/services/mapa/mapbox.service';
import { AppIconComponent, buildInlineIconSvg, IconName } from '../app-icon/app-icon.component';

const SANTA_CRUZ_CENTER: LatLng = { lat: -17.7863, lng: -63.1812 };

export interface TrackingRouteMetrics {
  distanceKm: number;
  durationMin: number;
}

@Component({
  selector: 'app-servicio-tracking-map',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  template: `
    <section class="tracking-card">
      <header class="tracking-header">
        <div>
          <h4>Seguimiento del servicio</h4>
          <p *ngIf="professionalName">Profesional: <strong>{{ professionalName }}</strong></p>
        </div>
        <div class="meta">
          <span class="pill route-pill" *ngIf="routeColor" [style.--route-color]="routeColor">Ruta exclusiva</span>
          <span class="pill" *ngIf="etaMin != null">ETA {{ etaMin }} min</span>
          <span class="pill" *ngIf="updatedAt">Actualizado</span>
        </div>
      </header>
      <div #mapHost class="map-host"></div>
      <footer class="legend">
        <span class="legend-item"><i class="dot client"><app-icon name="user" [size]="10" /></i> Cliente</span>
        <span class="legend-item"><i class="dot service"><app-icon name="alert" [size]="10" /></i> Servicio</span>
        <span class="legend-item" *ngIf="workshopLocation"><i class="dot workshop"><app-icon name="wrench" [size]="10" /></i> Taller</span>
        <span class="legend-item"><i class="dot pro"><app-icon name="car" [size]="10" /></i> Profesional</span>
      </footer>
    </section>
  `,
  styles: [`
    .tracking-card { border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 18px; overflow: hidden; background: #fff; }
    .tracking-header { display: flex; justify-content: space-between; gap: 10px; align-items: start; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; }
    .tracking-header h4 { margin: 0; color: #0f172a; }
    .tracking-header p { margin: 4px 0 0; color: #64748b; font-size: 0.9rem; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill { padding: 6px 10px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; font-size: 0.75rem; font-weight: 700; }
    .route-pill { background: color-mix(in srgb, var(--route-color, #2563eb) 16%, white); color: var(--route-color, #2563eb); }
    .map-host { height: 320px; width: 100%; }
    .legend { display: flex; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #475569; }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; }
    .dot {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      display: inline-grid;
      place-items: center;
      color: #ffffff;
      border: 1.5px solid rgba(255, 255, 255, 0.95);
      box-shadow: 0 6px 12px rgba(15, 23, 42, 0.18);
      font-style: normal;
    }
    .dot.client { background: linear-gradient(135deg, #2563eb, #1d4ed8); }
    .dot.service { background: linear-gradient(135deg, #ef4444, #dc2626); }
    .dot.workshop { background: linear-gradient(135deg, #f59e0b, #f97316); }
    .dot.pro { background: linear-gradient(135deg, #16a34a, #15803d); }
    @media (max-width: 640px) {
      .tracking-header { flex-direction: column; align-items: flex-start; }
      .map-host { height: 260px; }
    }
  `]
})
export class ServicioTrackingMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapHost', { static: true }) mapHost!: ElementRef<HTMLDivElement>;

  @Input() clientLocation: LatLng | null = null;
  @Input() serviceLocation: LatLng | null = null;
  @Input() professionalLocation: LatLng | null = null;
  /// Taller asignado. Cuando se provee, se dibuja una segunda ruta (más
  /// tenue, en color naranja) desde el incidente hasta el taller — así el
  /// cliente y el operador siempre ven el camino completo, no solo el tramo
  /// del técnico hacia el incidente.
  @Input() workshopLocation: LatLng | null = null;
  @Input() workshopName: string | null = null;
  /// Ruta servicio→taller pre-calculada por el backend (`solicitud.ruta_osrm`).
  /// Si viene con ≥3 coordenadas la usamos directo — es la **fuente de
  /// verdad** porque ya pasó por Mapbox Directions con fallback en el
  /// servidor. Solo si está vacía o tiene ≤2 puntos intentamos calcular
  /// desde el cliente. Y si TODO falla, NO dibujamos línea — una recta
  /// atravesando manzanas le miente al usuario sobre el camino real.
  ///
  /// Formato: GeoJSON `{type: "LineString", coordinates: [[lng, lat], ...]}`
  /// (el orden lng-primero es el estándar de Mapbox/GeoJSON).
  @Input() serverWorkshopRoute: { type?: string; coordinates?: [number, number][] } | null = null;
  @Input() professionalName: string | null = null;
  @Input() etaMin: number | null = null;
  @Input() updatedAt: string | null = null;
  @Input() routeColor: string | null = null;
  @Input() trackingEnabled = false;
  @Output() routeMetrics = new EventEmitter<TrackingRouteMetrics | null>();

  private mapboxgl: any;
  private map: any;
  private mapReady = false;
  private markers = new Map<string, any>();
  private readonly routeSourceId = 'tracking-route-source';
  private readonly routeLayerId = 'tracking-route-layer';
  // Secondary route layer: incident → workshop (planned path)
  private readonly workshopRouteSourceId = 'tracking-workshop-route-source';
  private readonly workshopRouteLayerId = 'tracking-workshop-route-layer';
  private resizeObserver: ResizeObserver | null = null;
  // Animación de "despacho": mueve el marcador profesional a lo largo de la
  // ruta mientras dura la simulación de salida del taller hacia el incidente.
  private dispatchRaf: number | null = null;
  private animating = false;

  constructor(private readonly mapbox: MapboxService) {}

  ngAfterViewInit(): void {
    void this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      !this.map ||
      !this.mapReady ||
      (
        !changes['clientLocation'] &&
        !changes['serviceLocation'] &&
        !changes['professionalLocation'] &&
        !changes['workshopLocation'] &&
        !changes['trackingEnabled'] &&
        !changes['routeColor'] &&
        !changes['serverWorkshopRoute']
      )
    ) {
      return;
    }
    this.sync();
  }

  ngOnDestroy(): void {
    if (this.dispatchRaf !== null) {
      cancelAnimationFrame(this.dispatchRaf);
      this.dispatchRaf = null;
    }
    this.animating = false;
    try {
      this.resizeObserver?.disconnect?.();
    } catch {
    }
    this.resizeObserver = null;
    for (const marker of this.markers.values()) {
      try {
        marker.remove?.();
      } catch {
      }
    }
    this.removeWorkshopRouteLayer();
    try {
      this.map?.remove?.();
    } catch {
    }
  }

  private async initMap(): Promise<void> {
    const container = this.mapHost?.nativeElement;
    if (!container) return;
    const mod = await import('mapbox-gl');
    this.mapboxgl = mod.default;
    const token = await this.mapbox.getAccessToken();
    const styleUrl = await this.mapbox.getStyleUrl();
    this.mapboxgl.accessToken = token;
    this.map = new this.mapboxgl.Map({
      container,
      style: styleUrl,
      center: [SANTA_CRUZ_CENTER.lng, SANTA_CRUZ_CENTER.lat],
      zoom: 13,
    });
    this.map.addControl(new this.mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    this.map.on('load', () => {
      this.mapReady = true;
      try {
        this.map.resize?.();
      } catch {
      }
      try {
        this.resizeObserver = new ResizeObserver(() => {
          try {
            this.map?.resize?.();
          } catch {
          }
        });
        this.resizeObserver.observe(container);
      } catch {
      }
      this.sync();
    });
  }

  private sync(): void {
    if (!this.map || !this.mapReady) return;
    // Durante la simulación de despacho movemos el marcador profesional a
    // mano; evitamos que un refresco de inputs lo devuelva a su posición.
    if (this.animating) return;
    this.upsertMarker('client', this.clientLocation, '#2563eb', 'Cliente');
    this.upsertMarker('service', this.serviceLocation, '#ef4444', 'Servicio');
    this.upsertMarker('workshop', this.workshopLocation, '#f97316', this.workshopName || 'Taller');
    this.upsertMarker('professional', this.professionalLocation, '#16a34a', this.professionalName || 'Profesional');
    void this.drawRoute();
    void this.drawWorkshopRoute();
    this.fit();
  }

  private upsertMarker(key: string, point: LatLng | null, color: string, label: string): void {
    const current = this.markers.get(key);
    if (!point) {
      current?.remove?.();
      this.markers.delete(key);
      return;
    }
    const iconName: IconName =
      key === 'client'   ? 'user'
      : key === 'service'  ? 'alert'
      : key === 'workshop' ? 'wrench'
      : 'car';
    const element = document.createElement('div');
    element.className = 'tracking-mapbox-marker';
    element.innerHTML = `<div style="width:22px;height:22px;border-radius:999px;display:grid;place-items:center;background:${color};color:#fff;border:2px solid rgba(255,255,255,.98);box-shadow:0 8px 16px rgba(15,23,42,.22)">${buildInlineIconSvg(iconName, { size: 10, strokeWidth: 2.1 })}</div>`;
    if (current) {
      current.setLngLat([point.lng, point.lat]);
      current.setPopup(new this.mapboxgl.Popup({ offset: 18 }).setText(label));
      return;
    }
    const marker = new this.mapboxgl.Marker({ element })
      .setLngLat([point.lng, point.lat])
      .setPopup(new this.mapboxgl.Popup({ offset: 18 }).setText(label))
      .addTo(this.map);
    this.markers.set(key, marker);
  }

  private async drawRoute(): Promise<void> {
    if (!this.trackingEnabled || !this.professionalLocation || !this.serviceLocation) {
      this.removeRouteLayer();
      this.routeMetrics.emit(null);
      return;
    }
    try {
      const route = await this.mapbox.route(this.professionalLocation, this.serviceLocation);
      this.renderRoute(route.coords);
      this.routeMetrics.emit({ distanceKm: route.distanceKm, durationMin: route.durationMin });
    } catch {
      this.removeRouteLayer();
      this.routeMetrics.emit(null);
    }
  }

  /// Draws a secondary, lighter polyline from the incident location to the
  /// assigned workshop. This is the "planned" path — always shown when both
  /// endpoints are known, regardless of whether the professional is moving.
  /// Color is a dashed orange so it never conflicts with the live tracking
  /// route (which uses ``routeColor``, defaulting to blue).
  private async drawWorkshopRoute(): Promise<void> {
    if (!this.serviceLocation || !this.workshopLocation) {
      this.removeWorkshopRouteLayer();
      return;
    }

    // 1) Preferir la ruta del backend (`solicitud.ruta_osrm`). El servidor
    //    ya llamó Mapbox Directions y persistió la geometría real con
    //    todos sus vértices viales. No re-calcular acá si ya la tenemos.
    const serverCoords = this.extractServerRouteCoords();
    if (serverCoords && serverCoords.length >= 3) {
      this.renderWorkshopRoute(serverCoords);
      return;
    }

    // 2) Backend no tiene ruta computada todavía. Intentar con el cliente
    //    Mapbox del frontend como mejor esfuerzo.
    try {
      const route = await this.mapbox.route(this.serviceLocation, this.workshopLocation);
      // mapbox.route() devuelve [lat, lng] — convertimos a [lng, lat]
      // que es lo que esperan tanto renderWorkshopRoute como Mapbox GL.
      const coords = route.coords.map(([lat, lng]) => [lng, lat] as [number, number]);
      this.renderWorkshopRoute(coords);
    } catch {
      // 3) Nadie pudo calcular una ruta vial. Antes preferíamos no dibujar
      //    nada (una recta "miente" sobre el trayecto real), pero en el flujo
      //    "taller sin técnico" el usuario necesita ver el trayecto y el
      //    muñeco anima sobre esta misma recta. Dibujamos una recta punteada
      //    taller↔incidente como estimación de último recurso.
      this.renderWorkshopRoute([
        [this.workshopLocation.lng, this.workshopLocation.lat],
        [this.serviceLocation.lng, this.serviceLocation.lat],
      ]);
    }
  }

  /// Devuelve las coordenadas del `serverWorkshopRoute` en formato
  /// [lng, lat][] (estándar Mapbox/GeoJSON) o null si el input es inválido
  /// o representa una línea recta degenerada (≤2 puntos = no es una ruta
  /// vial real, es el fallback Haversine del backend).
  private extractServerRouteCoords(): [number, number][] | null {
    const raw = this.serverWorkshopRoute;
    if (!raw || raw.type !== 'LineString' || !Array.isArray(raw.coordinates)) {
      return null;
    }
    const coords = raw.coordinates.filter(
      (c): c is [number, number] =>
        Array.isArray(c) && c.length === 2
        && typeof c[0] === 'number' && typeof c[1] === 'number'
        && Number.isFinite(c[0]) && Number.isFinite(c[1]),
    );
    if (coords.length < 3) {
      // ≤2 puntos significa que el backend cayó en fallback Haversine.
      // No la usamos — devolvemos null para que el caller intente otro
      // path (mapbox.route() del cliente) antes de renderizar nada.
      return null;
    }
    return coords;
  }

  /// `coords` deben venir en formato GeoJSON: `[lng, lat]` (lng-primero).
  /// Esto es el estándar de Mapbox GL y de la geometría que persiste el
  /// backend, así evitamos un swap que en versiones anteriores generaba
  /// confusión al cruzar capas.
  private renderWorkshopRoute(coords: Array<[number, number]>): void {
    const data = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords
      }
    };
    const source = this.map.getSource(this.workshopRouteSourceId);
    if (source) {
      source.setData(data);
      return;
    }
    this.map.addSource(this.workshopRouteSourceId, { type: 'geojson', data });
    this.map.addLayer({
      id: this.workshopRouteLayerId,
      type: 'line',
      source: this.workshopRouteSourceId,
      paint: {
        'line-color':      '#f97316',     // orange (workshop endpoint color)
        'line-width':      4,
        'line-opacity':    0.75,
        'line-dasharray':  [1.5, 1.2]     // dashed so the live route stays prominent
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' }
    });
    // Make sure the live tracking route is drawn on top of the workshop route.
    if (this.map.getLayer(this.routeLayerId)) {
      this.map.moveLayer(this.routeLayerId);
    }
  }

  private removeWorkshopRouteLayer(): void {
    if (!this.map) return;
    try {
      if (this.map.getLayer(this.workshopRouteLayerId)) {
        this.map.removeLayer(this.workshopRouteLayerId);
      }
      if (this.map.getSource(this.workshopRouteSourceId)) {
        this.map.removeSource(this.workshopRouteSourceId);
      }
    } catch {}
  }

  private fit(): void {
    if (!this.map || !this.mapReady) return;
    const points = [this.clientLocation, this.serviceLocation, this.professionalLocation, this.workshopLocation]
      .filter((item): item is LatLng => !!item);
    if (!points.length) {
      this.map.easeTo({ center: [SANTA_CRUZ_CENTER.lng, SANTA_CRUZ_CENTER.lat], zoom: 13, duration: 500 });
      return;
    }
    if (points.length === 1) {
      this.map.easeTo({ center: [points[0].lng, points[0].lat], zoom: 15, duration: 500 });
      return;
    }
    const bounds = points.reduce((acc, point) => acc.extend([point.lng, point.lat]), new this.mapboxgl.LngLatBounds());
    this.map.fitBounds(bounds, { padding: 48, duration: 500 });
  }

  private renderRoute(coords: Array<[number, number]>): void {
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
      this.map.setPaintProperty(this.routeLayerId, 'line-color', this.routeColor || '#2563eb');
      return;
    }
    this.map.addSource(this.routeSourceId, { type: 'geojson', data });
    this.map.addLayer({
      id: this.routeLayerId,
      type: 'line',
      source: this.routeSourceId,
      paint: {
        'line-color': this.routeColor || '#2563eb',
        'line-width': typeof window !== 'undefined' && window.innerWidth < 640 ? 5 : 6,
        'line-opacity': 0.9
      }
    });
  }

  private removeRouteLayer(): void {
    if (!this.map) return;
    try {
      if (this.map.getLayer(this.routeLayerId)) {
        this.map.removeLayer(this.routeLayerId);
      }
      if (this.map.getSource(this.routeSourceId)) {
        this.map.removeSource(this.routeSourceId);
      }
    } catch {
    }
  }

  /// Simula el despacho: anima el marcador profesional (el "muñeco") desde el
  /// taller hasta el incidente a lo largo de `durationMs`. Sigue la polyline
  /// vial cuando existe (`serverWorkshopRoute`); si no, una recta taller→servicio.
  /// Resuelve cuando la animación termina. El llamador se encarga de las
  /// transiciones de estado (EN_CAMINO antes, EN_ATENCION después).
  playDispatch(durationMs = 12000): Promise<void> {
    if (!this.map || !this.mapReady || !this.workshopLocation || !this.serviceLocation) {
      return Promise.resolve();
    }
    const path = this.buildDispatchPath(this.workshopLocation, this.serviceLocation);
    const segLen: number[] = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const d = this.haversineMeters(path[i - 1], path[i]);
      segLen.push(d);
      total += d;
    }
    if (total <= 0) {
      return Promise.resolve();
    }

    // Aseguramos que el marcador profesional exista en el punto de salida.
    this.animating = true;
    this.upsertMarker(
      'professional',
      { lat: path[0][1], lng: path[0][0] },
      '#16a34a',
      this.professionalName || 'En camino',
    );
    const marker = this.markers.get('professional');
    if (!marker) {
      this.animating = false;
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const startTs = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const finish = () => {
        this.dispatchRaf = null;
        this.animating = false;
        // Dejamos el marcador exactamente sobre el incidente.
        marker.setLngLat(path[path.length - 1]);
        resolve();
      };
      const step = () => {
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const t = Math.min(1, (now - startTs) / durationMs);
        const target = t * total;
        let acc = 0;
        let idx = 0;
        while (idx < segLen.length && acc + segLen[idx] < target) {
          acc += segLen[idx];
          idx++;
        }
        const a = path[idx] ?? path[path.length - 1];
        const b = path[idx + 1] ?? a;
        const frac = segLen[idx] ? (target - acc) / segLen[idx] : 0;
        marker.setLngLat([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
        if (t < 1) {
          this.dispatchRaf = requestAnimationFrame(step);
        } else {
          finish();
        }
      };
      this.dispatchRaf = requestAnimationFrame(step);
    });
  }

  /// Construye la trayectoria [lng, lat][] del taller al incidente. Prefiere la
  /// polyline vial del backend, orientada para que arranque cerca del taller.
  private buildDispatchPath(start: LatLng, end: LatLng): Array<[number, number]> {
    const coords = this.extractServerRouteCoords();
    if (coords && coords.length >= 3) {
      const startPt: [number, number] = [start.lng, start.lat];
      const dFirst = this.haversineMeters(startPt, coords[0]);
      const dLast = this.haversineMeters(startPt, coords[coords.length - 1]);
      return dFirst <= dLast ? coords.slice() : coords.slice().reverse();
    }
    return [[start.lng, start.lat], [end.lng, end.lat]];
  }

  /// Distancia en metros entre dos puntos [lng, lat] (Haversine).
  private haversineMeters(a: [number, number], b: [number, number]): number {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
}
