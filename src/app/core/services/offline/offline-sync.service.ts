import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { SolicitudCreatePayload, SolicitudSeleccionTallerPayload } from '../../models/gestion-solicitudes/api.models';
import { AuthService } from '../autenticacion-acceso/auth.service';
import { EmergencyApiService } from '../gestion-solicitudes/emergency-api.service';
import { PushNotificationsService } from '../notificaciones/push-notifications.service';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type OfflineActionType =
  | 'CREATE_SOLICITUD'
  | 'UPDATE_ESTADO'
  | 'UPLOAD_EVIDENCIA'
  | 'UPDATE_UBICACION'
  | 'SELECCIONAR_TALLER';

export interface OfflineAction {
  id: string;
  type: OfflineActionType;
  payload: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const QUEUE_KEY = 'offline.action_queue';
const LAST_SYNC_KEY = 'offline.last_sync';
const LAST_NOTIFICATION_KEY = 'offline.lastSeenNotificationAt';
const MAX_RETRIES = 5;
const RETRY_BACKOFF_BASE_MS = 2000;

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(EmergencyApiService);
  private readonly push = inject(PushNotificationsService);

  /** true cuando el navegador reporta conexión activa */
  readonly isOnline = signal<boolean>(navigator.onLine);
  /** acciones pendientes de sincronizar */
  readonly pendingCount = computed(() => this._queue().length);
  /** ISO string de la última sincronización exitosa */
  readonly lastSync = signal<string | null>(localStorage.getItem(LAST_SYNC_KEY));

  private readonly _queue = signal<OfflineAction[]>(this._loadQueue());
  private _syncInFlight = false;

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline.set(true);
      void this._syncAll();
    });
    window.addEventListener('offline', () => this.isOnline.set(false));

    if (navigator.onLine) {
      void this._syncAll();
    }
  }

  // ---------------------------------------------------------------------------
  // API pública
  // ---------------------------------------------------------------------------

  /** Encola una acción para cuando haya conexión. */
  enqueue(type: OfflineActionType, payload: unknown): string {
    const action: OfflineAction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    const updated = [...this._queue(), action];
    this._queue.set(updated);
    this._persistQueue(updated);

    if (this.isOnline()) {
      void this._syncAll();
    }
    return action.id;
  }

  /** Elimina una acción de la cola manualmente (p.ej. si el usuario la cancela). */
  remove(id: string): void {
    const updated = this._queue().filter(a => a.id !== id);
    this._queue.set(updated);
    this._persistQueue(updated);
  }

  /** Fuerza una sincronización inmediata (para llamar desde UI). */
  async syncNow(): Promise<void> {
    await this._syncAll();
  }

  // ---------------------------------------------------------------------------
  // Lógica interna
  // ---------------------------------------------------------------------------

  private async _syncAll(): Promise<void> {
    if (this._syncInFlight) return;
    if (!navigator.onLine) return;
    if (!this.auth.hasToken()) return;

    this._syncInFlight = true;
    try {
      await this._flushQueue();
      await this._syncNotifications();
      this.lastSync.set(new Date().toISOString());
      localStorage.setItem(LAST_SYNC_KEY, this.lastSync()!);
    } finally {
      this._syncInFlight = false;
    }
  }

  /** Ejecuta las acciones pendientes en orden FIFO con retry exponencial. */
  private async _flushQueue(): Promise<void> {
    const queue = [...this._queue()];
    if (!queue.length) return;

    const remaining: OfflineAction[] = [];

    for (const action of queue) {
      if (action.retryCount >= MAX_RETRIES) {
        // Descartamos acciones que excedieron reintentos
        continue;
      }
      const success = await this._executeAction(action);
      if (!success) {
        remaining.push({
          ...action,
          retryCount: action.retryCount + 1,
        });
      }
    }

    this._queue.set(remaining);
    this._persistQueue(remaining);
  }

  private async _executeAction(action: OfflineAction): Promise<boolean> {
    if (action.retryCount > 0) {
      await _sleep(RETRY_BACKOFF_BASE_MS * 2 ** (action.retryCount - 1));
    }
    try {
      switch (action.type) {
        case 'CREATE_SOLICITUD':
          await firstValueFrom(
            this.api.createSolicitud(action.payload as SolicitudCreatePayload)
          );
          break;

        case 'UPDATE_ESTADO': {
          const p = action.payload as { id: number; estadoId: number; observacion: string };
          await firstValueFrom(this.api.actualizarEstado(p.id, p.estadoId, p.observacion));
          break;
        }

        case 'SELECCIONAR_TALLER': {
          const p = action.payload as { id: number; body: SolicitudSeleccionTallerPayload };
          await firstValueFrom(this.api.seleccionarTallerSolicitud(p.id, p.body));
          break;
        }

        case 'UPLOAD_EVIDENCIA':
        case 'UPDATE_UBICACION':
          // Acciones de archivo/ubicación requieren FormData — se omiten en la cola
          // persistente y deben reintentarse manualmente por el usuario.
          return true;

        default:
          return true;
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Sincroniza notificaciones perdidas mientras se estuvo offline. */
  private async _syncNotifications(): Promise<void> {
    const lastSeenRaw = localStorage.getItem(LAST_NOTIFICATION_KEY);
    const lastSeen = lastSeenRaw ? new Date(lastSeenRaw) : null;

    try {
      const notifications = await firstValueFrom(this.api.getNotificaciones());
      const sorted = [...notifications].sort((a, b) => (a.fecha_creacion > b.fecha_creacion ? 1 : -1));
      const newest = sorted.at(-1);
      if (newest?.fecha_creacion) {
        localStorage.setItem(LAST_NOTIFICATION_KEY, newest.fecha_creacion);
      }
      if (!lastSeen) return;

      for (const n of sorted) {
        const created = new Date(n.fecha_creacion);
        if (Number.isNaN(created.getTime())) continue;
        if (created <= lastSeen) continue;
        await this.push.notifyInForeground(n.titulo, n.mensaje, '/notificaciones');
      }
    } catch {
      // Silencioso — no bloquear el flujo offline
    }
  }

  private _loadQueue(): OfflineAction[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OfflineAction[]) : [];
    } catch {
      return [];
    }
  }

  private _persistQueue(queue: OfflineAction[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // localStorage lleno — ignorar
    }
  }
}

function _sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
