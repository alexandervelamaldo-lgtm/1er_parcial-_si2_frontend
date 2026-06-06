import { Injectable, inject, signal } from '@angular/core';

import { AuthService } from '../autenticacion-acceso/auth.service';
import { TenantService } from '../tenant/tenant.service';
import { TecnicoPunto } from '../../../shared/components/mapa-picker/mapa-picker.component';
import { environment } from '../../../../environments/environment';

type SolicitudUpdateMessage = {
  type: 'solicitud_update';
  solicitud_id: number;
  estado: string;
  taller_id?: number | null;
  tecnico_id?: number | null;
  updated_at?: string | null;
};

type KpiRefreshMessage = { type: 'kpi_refresh' };
type NotificationEventMessage = {
  type: 'notification_event';
  titulo: string;
  mensaje: string;
  notification_type: string;
  url?: string | null;
  diagnostico_categoria?: string | null;
};

type TrackingMessage =
  | { type: 'init'; tecnicos: TecnicoPunto[] }
  | { type: 'location_update'; tecnico_id: number; lat: number; lng: number; disponible?: boolean; updated_at?: string | null }
  | SolicitudUpdateMessage
  | KpiRefreshMessage
  | NotificationEventMessage
  | { type: 'pong' }
  | { type: 'error'; detail: string };

@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly heartbeatMs = 20_000;
  private readonly pongTimeoutMs = 10_000;
  private readonly baseReconnectMs = 1_500;
  private readonly maxReconnectMs = 15_000;

  readonly tecnicos = signal<TecnicoPunto[]>([]);
  readonly connected = signal<boolean>(false);
  readonly solicitudUpdate = signal<SolicitudUpdateMessage | null>(null);
  readonly notificationEvent = signal<NotificationEventMessage | null>(null);
  readonly notificationRefreshVersion = signal(0);
  readonly kpiRefreshVersion = signal(0);

  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectEnabled = true;
  private heartbeatTimer: number | null = null;
  private pongTimer: number | null = null;
  private reconnectDelayMs = this.baseReconnectMs;
  private consumers = 0;

  constructor() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  connect() {
    this.consumers += 1;
    this.reconnectEnabled = true;
    this._openSocket();
  }

  disconnect() {
    if (this.consumers > 0) {
      this.consumers -= 1;
    }
    if (this.consumers > 0) {
      return;
    }
    this.reconnectEnabled = false;
    this._clearReconnectTimer();
    this._clearHeartbeatTimers();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.connected.set(false);
  }

  sendMyLocation(lat: number, lng: number) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'location_update', lat, lng }));
  }

  private _openSocket() {
    if (this.ws) return;
    if (this.consumers <= 0) return;
    const token = this.auth.getToken();
    if (!token) return;
    this._clearReconnectTimer();

    const tenant = this.tenant.getTenant();
    const socketBaseUrl = this._resolveSocketBaseUrl();
    const url = `${socketBaseUrl}/realtime/tracking?access_token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(
      tenant
    )}`;

    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.reconnectDelayMs = this.baseReconnectMs;
      this.connected.set(true);
      this._startHeartbeat();
    };
    this.ws.onclose = () => {
      this._clearHeartbeatTimers();
      this.connected.set(false);
      this.ws = null;
      if (this.reconnectEnabled && this.consumers > 0) {
        this._scheduleReconnect();
      }
    };
    this.ws.onerror = () => {
      this.connected.set(false);
      if (this.ws && this.ws.readyState < WebSocket.CLOSING) {
        this.ws.close();
      }
    };
    this.ws.onmessage = (ev) => {
      let msg: TrackingMessage | null = null;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        msg = null;
      }
      if (!msg || typeof (msg as any).type !== 'string') return;
      this._applyMessage(msg);
    };
  }

  private _applyMessage(msg: TrackingMessage) {
    if (msg.type === 'init') {
      this.tecnicos.set(msg.tecnicos || []);
      return;
    }
    if (msg.type === 'location_update') {
      const id = msg.tecnico_id;
      const current = this.tecnicos();
      const existing = current.find((t) => t.id === id);
      const updated: TecnicoPunto = {
        id,
        nombre: existing?.nombre || `Taller ${id}`,
        lat: msg.lat,
        lng: msg.lng,
        disponible: msg.disponible ?? existing?.disponible ?? true,
        updated_at: msg.updated_at ?? existing?.updated_at ?? null
      };
      const next = existing ? current.map((t) => (t.id === id ? updated : t)) : [...current, updated];
      this.tecnicos.set(next);
      return;
    }
    if (msg.type === 'solicitud_update') {
      this.solicitudUpdate.set(msg);
      this.notificationRefreshVersion.update((value) => value + 1);
      return;
    }
    if (msg.type === 'notification_event') {
      this.notificationEvent.set(msg);
      this.notificationRefreshVersion.update((value) => value + 1);
      return;
    }
    if (msg.type === 'kpi_refresh') {
      this.kpiRefreshVersion.update((value) => value + 1);
      return;
    }
    if (msg.type === 'pong') {
      this._clearPongTimer();
    }
  }

  private _scheduleReconnect() {
    if (!this.reconnectEnabled) return;
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelayMs;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.reconnectEnabled) return;
      if (this.consumers <= 0) return;
      if (!navigator.onLine) {
        this._scheduleReconnect();
        return;
      }
      this._openSocket();
    }, delay);
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, this.maxReconnectMs);
  }

  private _startHeartbeat() {
    this._clearHeartbeatTimers();
    this.heartbeatTimer = window.setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this._clearHeartbeatTimers();
        return;
      }
      this.ws.send(JSON.stringify({ type: 'ping' }));
      this._clearPongTimer();
      this.pongTimer = window.setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        }
      }, this.pongTimeoutMs);
    }, this.heartbeatMs);
  }

  private _clearHeartbeatTimers() {
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this._clearPongTimer();
  }

  private _clearPongTimer() {
    if (this.pongTimer) {
      window.clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private _clearReconnectTimer() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private readonly handleOnline = () => {
    if (!this.reconnectEnabled || this.consumers <= 0) return;
    this._openSocket();
  };

  private readonly handleOffline = () => {
    this.connected.set(false);
  };

  private _resolveSocketBaseUrl(): string {
    const explicitBaseUrl = environment.wsBaseUrl?.trim();
    if (explicitBaseUrl) {
      return this._normalizeSocketBaseUrl(explicitBaseUrl);
    }
    const apiUrl = environment.apiUrl?.trim();
    if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
      return this._normalizeSocketBaseUrl(apiUrl);
    }
    return this._normalizeSocketBaseUrl(window.location.origin);
  }

  private _normalizeSocketBaseUrl(baseUrl: string): string {
    const parsed = new URL(baseUrl, window.location.origin);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  }
}
