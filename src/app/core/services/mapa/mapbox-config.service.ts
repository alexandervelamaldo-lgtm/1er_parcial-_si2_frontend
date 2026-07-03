import { Injectable } from '@angular/core';

import { environment } from '../../../../environments/environment';

export type MapboxPublicConfig = {
  mapboxPublicToken: string;
  mapboxStyleUrl: string;
};

@Injectable({ providedIn: 'root' })
export class MapboxConfigService {
  private configPromise: Promise<MapboxPublicConfig> | null = null;
  private resolvedConfig: MapboxPublicConfig | null = null;

  getConfig(): Promise<MapboxPublicConfig> {
    if (this.resolvedConfig) {
      return Promise.resolve(this.resolvedConfig);
    }
    if (this.configPromise) {
      return this.configPromise;
    }

    this.configPromise = fetch(`${environment.apiUrl}/config/maps-key`, { method: 'GET' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('No se pudo obtener la configuración de Mapbox.');
        }
        const data = (await response.json()) as Partial<MapboxPublicConfig>;
        const token = String(data?.mapboxPublicToken || '').trim();
        const style = String(data?.mapboxStyleUrl || 'mapbox://styles/mapbox/standard').trim();
        if (token.length < 10) {
          throw new Error('Mapbox no está configurado en el backend.');
        }
        const resolved = {
          mapboxPublicToken: token,
          mapboxStyleUrl: style || 'mapbox://styles/mapbox/standard'
        };
        this.resolvedConfig = resolved;
        return resolved;
      })
      .finally(() => {
        this.configPromise = null;
      });

    return this.configPromise;
  }
}
