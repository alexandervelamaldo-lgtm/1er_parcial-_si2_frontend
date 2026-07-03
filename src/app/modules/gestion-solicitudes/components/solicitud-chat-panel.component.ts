import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import {
  ChatSolicitudService,
  SolicitudChatMessage
} from '../../../core/services/gestion-solicitudes/chat-solicitud.service';
import { AuthService } from '../../../core/services/autenticacion-acceso/auth.service';
import { TrackingService } from '../../../core/services/tracking/tracking.service';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

/**
 * Panel de chat en vivo cliente ↔ técnico para el detalle de solicitud.
 *
 * Hidrata el historial vía HTTP y se suscribe al signal `chatMessage` del
 * TrackingService (WS `/realtime/tracking`) para mensajes en tiempo real.
 * Solo se debe montar cuando el usuario en sesión es CLIENTE dueño o
 * TECNICO asignado — el backend igual valida y devolverá 403 si no.
 */
@Component({
  selector: 'app-solicitud-chat-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="chat-panel">
      <header class="chat-panel__header">
        <div>
          <h3><app-icon name="message" [size]="18" /> Chat con el {{ contraparteLabel() }}</h3>
          <p class="chat-panel__hint" *ngIf="!disabled">Los mensajes se guardan en el historial.</p>
          <p class="chat-panel__hint chat-panel__hint--muted" *ngIf="disabled">
            {{ disabledReason() }}
          </p>
        </div>
      </header>

      <div class="chat-panel__body" #scrollAnchor>
        <p class="chat-panel__empty" *ngIf="messages().length === 0 && !loading()">
          Todavía no hay mensajes en este chat.
        </p>
        <p class="chat-panel__empty" *ngIf="loading() && messages().length === 0">
          Cargando historial…
        </p>
        <div
          class="chat-bubble"
          *ngFor="let msg of messages(); trackBy: trackById"
          [class.chat-bubble--mine]="msg.sender_user_id === myUserId()"
        >
          <span class="chat-bubble__author">{{ msg.sender_display_name }}</span>
          <span class="chat-bubble__content">{{ msg.content }}</span>
          <span class="chat-bubble__time">{{ msg.created_at | date:'shortTime' }}</span>
        </div>
      </div>

      <p class="chat-panel__error" *ngIf="error()">{{ error() }}</p>

      <form class="chat-panel__composer" (ngSubmit)="enviar()">
        <input
          type="text"
          name="mensaje"
          placeholder="Escribe un mensaje…"
          [(ngModel)]="borrador"
          [disabled]="disabled || sending()"
          autocomplete="off"
          maxlength="2000"
        />
        <button
          type="submit"
          [disabled]="disabled || sending() || !borrador.trim()"
          aria-label="Enviar mensaje"
        >
          <app-icon name="send" [size]="16" />
        </button>
      </form>
    </section>
  `,
  styles: [
    `
      .chat-panel {
        display: flex;
        flex-direction: column;
        background: #fff;
        border: 1px solid rgba(203, 213, 225, 0.7);
        border-radius: 14px;
        box-shadow: 0 6px 20px rgba(15, 23, 42, 0.06);
        overflow: hidden;
        min-height: 340px;
        max-height: 520px;
      }

      .chat-panel__header {
        padding: 0.9rem 1rem;
        border-bottom: 1px solid rgba(203, 213, 225, 0.6);
      }
      .chat-panel__header h3 {
        margin: 0;
        font-size: 1rem;
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      .chat-panel__hint {
        margin: 3px 0 0;
        color: #64748b;
        font-size: 0.8rem;
      }
      .chat-panel__hint--muted {
        color: #b45309;
      }

      .chat-panel__body {
        flex: 1;
        overflow-y: auto;
        padding: 0.9rem 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: #f8fafc;
      }

      .chat-panel__empty {
        margin: auto 0;
        color: #94a3b8;
        text-align: center;
        font-size: 0.85rem;
      }

      .chat-bubble {
        max-width: 78%;
        padding: 0.55rem 0.8rem;
        border-radius: 12px;
        background: #e2e8f0;
        color: #0f172a;
        display: flex;
        flex-direction: column;
        gap: 2px;
        word-break: break-word;
        white-space: pre-wrap;
      }
      .chat-bubble--mine {
        align-self: flex-end;
        background: #1d4ed8;
        color: #fff;
      }
      .chat-bubble__author {
        font-size: 0.72rem;
        opacity: 0.75;
        font-weight: 600;
      }
      .chat-bubble__content {
        font-size: 0.92rem;
        line-height: 1.35;
      }
      .chat-bubble__time {
        font-size: 0.68rem;
        opacity: 0.7;
        align-self: flex-end;
      }

      .chat-panel__error {
        margin: 0;
        padding: 0.5rem 1rem;
        background: #fff1f2;
        color: #b91c1c;
        font-size: 0.8rem;
      }

      .chat-panel__composer {
        display: flex;
        gap: 0.5rem;
        padding: 0.7rem 0.9rem;
        border-top: 1px solid rgba(203, 213, 225, 0.6);
      }
      .chat-panel__composer input {
        flex: 1;
        border: 1px solid rgba(203, 213, 225, 0.9);
        border-radius: 999px;
        padding: 0.55rem 0.9rem;
        font-size: 0.9rem;
      }
      .chat-panel__composer button {
        border: none;
        border-radius: 999px;
        background: #1d4ed8;
        color: #fff;
        padding: 0.55rem 0.9rem;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
      }
      .chat-panel__composer button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    `
  ]
})
export class SolicitudChatPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) solicitudId!: number;
  /** Cuando true, el composer queda deshabilitado (solicitud cerrada/cancelada). */
  @Input() disabled = false;
  /** Rol del usuario en sesión, para el label del header. */
  @Input() miRol: 'cliente' | 'tecnico' | 'taller' = 'cliente';
  /** Cuando el que mira es el cliente: hay técnico ya asignado o solo taller.
   *  Se usa para elegir el label del header ("técnico" vs "taller"). */
  @Input() hayTecnicoAsignado = false;
  /** Motivo del composer deshabilitado (para mostrar al usuario). */
  @Input() disabledReasonText = 'Esta solicitud ya no está activa. Solo se muestra el historial.';

  private readonly chatSvc = inject(ChatSolicitudService);
  private readonly tracking = inject(TrackingService);
  private readonly auth = inject(AuthService);

  readonly messages = signal<SolicitudChatMessage[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly myUserId = signal<number | null>(null);
  borrador = '';

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  constructor() {
    // Suscripción reactiva al último chat_message del WS. Se dispara con
    // cada evento nuevo; filtramos por solicitud_id para ignorar los que
    // no son de esta pantalla y por sender_user_id para no duplicar los
    // que ya insertamos al hacer POST (optimistic).
    effect(() => {
      const ev = this.tracking.chatMessage();
      if (!ev || ev.solicitud_id !== this.solicitudId) return;
      const yaExiste = this.messages().some((m) => m.id === ev.message.id);
      if (yaExiste) return;
      const nueva: SolicitudChatMessage = {
        id: ev.message.id,
        solicitud_id: ev.solicitud_id,
        sender_user_id: ev.message.sender_user_id,
        sender_role: ev.message.sender_role,
        sender_display_name: ev.message.sender_display_name,
        content: ev.message.content,
        created_at: ev.message.created_at ?? new Date().toISOString(),
        read_at: null
      };
      this.messages.update((prev) => [...prev, nueva]);
      this.scrollToBottom();
      if (nueva.sender_user_id !== this.myUserId()) {
        void this.chatSvc.marcarLeidos(this.solicitudId).subscribe({
          error: () => undefined
        });
      }
    });
  }

  ngOnInit(): void {
    this.myUserId.set(this.auth.currentProfile()?.user?.id ?? null);
    this.tracking.connect();
    void this.hidratarHistorial();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['solicitudId'] && !changes['solicitudId'].firstChange) {
      this.messages.set([]);
      void this.hidratarHistorial();
    }
  }

  ngOnDestroy(): void {
    this.tracking.disconnect();
  }

  contraparteLabel(): string {
    // Cliente ve al técnico si ya está asignado, si no ve al taller.
    // Taller y técnico siempre ven al cliente del otro lado.
    if (this.miRol === 'cliente') {
      return this.hayTecnicoAsignado ? 'técnico' : 'taller';
    }
    return 'cliente';
  }

  disabledReason(): string {
    return this.disabledReasonText;
  }

  trackById(_: number, msg: SolicitudChatMessage): number {
    return msg.id;
  }

  async enviar(): Promise<void> {
    const texto = this.borrador.trim();
    if (!texto || this.sending() || this.disabled) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.chatSvc.enviar(this.solicitudId, texto));
      this.messages.update((prev) => {
        if (prev.some((m) => m.id === res.id)) return prev;
        return [...prev, res];
      });
      this.borrador = '';
      this.scrollToBottom();
    } catch (err: any) {
      const detail = err?.error?.detail;
      this.error.set(
        typeof detail === 'string' && detail
          ? detail
          : 'No se pudo enviar el mensaje. Intenta de nuevo.'
      );
    } finally {
      this.sending.set(false);
    }
  }

  private async hidratarHistorial(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.chatSvc.listar(this.solicitudId));
      this.messages.set(res.messages);
      this.scrollToBottom();
      void this.chatSvc.marcarLeidos(this.solicitudId).subscribe({
        error: () => undefined
      });
    } catch (err: any) {
      const detail = err?.error?.detail;
      this.error.set(
        typeof detail === 'string' && detail ? detail : 'No se pudo cargar el chat.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  private scrollToBottom(): void {
    queueMicrotask(() => {
      const el = this.scrollAnchor?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
