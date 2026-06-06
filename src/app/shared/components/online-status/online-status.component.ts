import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { OfflineSyncService } from '../../../core/services/offline/offline-sync.service';

/**
 * Chip de estado de conectividad.
 *
 * Muestra:
 *  - Indicador online / offline (verde / rojo)
 *  - Cantidad de acciones pendientes de sincronizar
 *  - Timestamp del último sync exitoso
 *
 * Uso: <app-online-status />
 */
@Component({
  selector: 'app-online-status',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="online-status-chip" [class.offline]="!sync.isOnline()">
      <span class="dot"></span>
      <span class="label">{{ sync.isOnline() ? 'En línea' : 'Sin conexión' }}</span>

      @if (sync.pendingCount() > 0) {
        <span class="pending-badge" title="Acciones pendientes de envío">
          {{ sync.pendingCount() }} pendiente{{ sync.pendingCount() !== 1 ? 's' : '' }}
        </span>
      }

      @if (lastSyncLabel()) {
        <span class="last-sync" title="Última sincronización">{{ lastSyncLabel() }}</span>
      }

      @if (!sync.isOnline()) {
        <button class="retry-btn" (click)="retrySyncIfOnline()">Reintentar</button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .online-status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #dcfce7;
      border: 1px solid #86efac;
      font-size: 12px;
      color: #166534;
      transition: background 0.2s, border-color 0.2s;
    }

    .online-status-chip.offline {
      background: #fee2e2;
      border-color: #fca5a5;
      color: #991b1b;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #16a34a;
      flex-shrink: 0;
    }

    .offline .dot {
      background: #dc2626;
    }

    .pending-badge {
      background: #fef08a;
      color: #713f12;
      border-radius: 999px;
      padding: 1px 7px;
      font-weight: 600;
      font-size: 11px;
    }

    .last-sync {
      color: inherit;
      opacity: 0.75;
      font-size: 11px;
    }

    .retry-btn {
      background: none;
      border: 1px solid currentColor;
      border-radius: 6px;
      padding: 2px 8px;
      font-size: 11px;
      cursor: pointer;
      color: inherit;

      &:hover { opacity: 0.8; }
    }
  `],
})
export class OnlineStatusComponent {
  protected readonly sync = inject(OfflineSyncService);

  protected readonly lastSyncLabel = computed(() => {
    const raw = this.sync.lastSync();
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;

    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return 'sync hace menos de 1 min';
    if (diffMin < 60) return `sync hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    return `sync hace ${diffH} h`;
  });

  protected retrySyncIfOnline(): void {
    if (navigator.onLine) {
      void this.sync.syncNow();
    }
  }
}
