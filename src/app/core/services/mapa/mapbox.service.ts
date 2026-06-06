import { Injectable } from '@angular/core';

import { MapboxConfigService } from './mapbox-config.service';

export type LatLng = { lat: number; lng: number };

type MapboxGeocodeFeature = {
  center?: [number, number];
  place_name?: string;
};

type MapboxGeocodeResponse = {
  features?: MapboxGeocodeFeature[];
};

type MapboxRouteResponse = {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
};

const MIN_SECONDS_PER_KM = 40;
const MAX_SECONDS_PER_KM = 180;

function isValidLatLng(v: any): v is LatLng {
  return (
    v &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    v.lat >= -90 &&
    v.lat <= 90 &&
    v.lng >= -180 &&
    v.lng <= 180
  );
}

function createLru<T>(maxEntries: number) {
  const map = new Map<string, T>();
  return {
    get(key: string): T | undefined {
      if (!map.has(key)) return undefined;
      const v = map.get(key)!;
      map.delete(key);
      map.set(key, v);
      return v;
    },
    set(key: string, value: T): void {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      while (map.size > maxEntries) {
        const first = map.keys().next().value as string | undefined;
        if (!first) break;
        map.delete(first);
      }
    }
  };
}

function createRateLimiter(minIntervalMs: number) {
  let lastStartedAt = 0;
  let chain: Promise<void> = Promise.resolve();

  return <T>(task: () => Promise<T>): Promise<T> => {
    const next = chain.then(async () => {
      const now = Date.now();
      const waitMs = Math.max(0, minIntervalMs - (now - lastStartedAt));
      if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
      lastStartedAt = Date.now();
      return task();
    });
    chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
}

function enforceDurationPerKm(distanceKm: number, durationSeconds: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error('La distancia de la ruta es inválida.');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('La duración de la ruta es inválida.');
  }

  const secondsPerKm = durationSeconds / distanceKm;
  if (secondsPerKm < MIN_SECONDS_PER_KM) {
    return distanceKm * MIN_SECONDS_PER_KM;
  }
  if (secondsPerKm > MAX_SECONDS_PER_KM) {
    return distanceKm * MAX_SECONDS_PER_KM;
  }
  return durationSeconds;
}

@Injectable({ providedIn: 'root' })
export class MapboxService {
  private readonly schedule = createRateLimiter(350);
  private readonly reverseCache = createLru<string>(120);
  private readonly searchCache = createLru<Array<{ lat: number; lng: number; displayName: string }>>(60);
  private readonly routeCache = createLru<{
    coords: Array<[number, number]>;
    distanceKm: number;
    durationMin: number;
  }>(80);

  constructor(private readonly config: MapboxConfigService) {}

  async getStyleUrl(): Promise<string> {
    const data = await this.config.getConfig();
    return data.mapboxStyleUrl;
  }

  async getAccessToken(): Promise<string> {
    const data = await this.config.getConfig();
    return data.mapboxPublicToken;
  }

  async reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string> {
    const safe: LatLng = { lat: Number(lat), lng: Number(lng) };
    if (!isValidLatLng(safe)) return '';

    const key = `${safe.lat.toFixed(5)},${safe.lng.toFixed(5)}`;
    const cached = this.reverseCache.get(key);
    if (cached !== undefined) return cached;

    const token = await this.getAccessToken();
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${safe.lng},${safe.lat}.json` +
      `?access_token=${encodeURIComponent(token)}&language=es&limit=1&country=BO`;

    const name = await this.schedule(async () => {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
      if (!res.ok) throw new Error('No se pudo obtener la dirección con Mapbox.');
      const data = (await res.json()) as MapboxGeocodeResponse;
      return String(data?.features?.[0]?.place_name || '');
    });

    this.reverseCache.set(key, name);
    return name;
  }

  async search(query: string, signal?: AbortSignal): Promise<Array<{ lat: number; lng: number; displayName: string }>> {
    const q = String(query || '').trim();
    if (!q) return [];

    const key = q.toLowerCase();
    const cached = this.searchCache.get(key);
    if (cached) return cached;

    const token = await this.getAccessToken();
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
      `?access_token=${encodeURIComponent(token)}&language=es&limit=6&country=BO&proximity=-63.1812,-17.7863`;

    const results = await this.schedule(async () => {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
      if (!res.ok) throw new Error('No se pudo buscar la dirección con Mapbox.');
      const data = (await res.json()) as MapboxGeocodeResponse;
      const items = Array.isArray(data?.features) ? data.features : [];
      return items
        .map((it) => {
          const lng = Number(it?.center?.[0]);
          const lat = Number(it?.center?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng, displayName: String(it?.place_name || '') };
        })
        .filter(Boolean) as Array<{ lat: number; lng: number; displayName: string }>;
    });

    this.searchCache.set(key, results);
    return results;
  }

  async route(
    from: LatLng,
    to: LatLng,
    signal?: AbortSignal
  ): Promise<{ coords: Array<[number, number]>; distanceKm: number; durationMin: number }> {
    const a: LatLng = { lat: Number(from?.lat), lng: Number(from?.lng) };
    const b: LatLng = { lat: Number(to?.lat), lng: Number(to?.lng) };
    if (!isValidLatLng(a) || !isValidLatLng(b)) {
      throw new Error('Coordenadas inválidas para ruta.');
    }

    const key = `${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;
    const cached = this.routeCache.get(key);
    if (cached) return cached;

    const token = await this.getAccessToken();
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${a.lng},${a.lat};${b.lng},${b.lat}` +
      `?access_token=${encodeURIComponent(token)}&alternatives=false&annotations=false&geometries=geojson&overview=full&steps=false`;

    const data = await this.schedule(async () => {
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal });
      if (!res.ok) throw new Error('No se pudo calcular la ruta con Mapbox.');
      return (await res.json()) as MapboxRouteResponse;
    });

    const route = data?.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (!route || !Array.isArray(coords) || coords.length < 2) {
      throw new Error('Ruta no disponible.');
    }

    const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
    const distanceKm = Number((Number(route.distance) / 1000).toFixed(2));
    const controlledDurationSeconds = enforceDurationPerKm(distanceKm, Number(route.duration));
    const durationMin = Math.round(controlledDurationSeconds / 60);

    const result = { coords: latLngs, distanceKm, durationMin };
    this.routeCache.set(key, result);
    return result;
  }
}
