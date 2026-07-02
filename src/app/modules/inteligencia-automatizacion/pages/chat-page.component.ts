import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AiChatMessage, AiService } from '../../../core/services/inteligencia-automatizacion/ai.service';
import { AppIconComponent } from '../../../shared/components/app-icon/app-icon.component';

type ChatDisplayMessage = AiChatMessage & { failed?: boolean };

// Cuántos mensajes previos se envían como contexto en cada solicitud.
// Debe ser igual o menor al límite que valida el backend (ver
// AiChatRequest.history en app/schemas/inteligencia_automatizacion/ai.py).
const MAX_HISTORIAL_ENVIADO = 20;

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  template: `
    <section class="chat-page">
      <header class="chat-page__header">
        <h1><app-icon name="message" [size]="22" /> Asistente virtual</h1>
        <p class="hint">
          Preguntame cómo reportar una emergencia, hacer seguimiento a una solicitud
          o cualquier duda sobre la plataforma.
        </p>
      </header>

      <div class="chat-card glass-card">
        <div class="chat-body" #scrollAnchor>
          <p class="chat-empty" *ngIf="messages().length === 0">
            Todavía no escribiste nada. Escribe tu primer mensaje para empezar la conversación.
          </p>
          <div
            class="chat-bubble"
            *ngFor="let msg of messages()"
            [class.chat-bubble--user]="msg.role === 'user'"
            [class.chat-bubble--assistant]="msg.role === 'assistant'"
            [class.chat-bubble--failed]="msg.failed"
          >
            {{ msg.content }}
          </div>
          <div class="chat-bubble chat-bubble--assistant chat-bubble--typing" *ngIf="busy()">
            Escribiendo…
          </div>
        </div>

        <p class="chat-error" *ngIf="error()">{{ error() }}</p>

        <form class="chat-input" (ngSubmit)="enviar()">
          <input
            type="text"
            name="mensaje"
            placeholder="Escribe tu mensaje…"
            [(ngModel)]="borrador"
            [disabled]="busy()"
            autocomplete="off"
          />
          <button type="submit" [disabled]="busy() || !borrador.trim()" aria-label="Enviar mensaje">
            <app-icon name="send" [size]="16" />
            Enviar
          </button>
        </form>
      </div>
    </section>
  `,
  styles: [
    `
      .chat-page {
        max-width: 760px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .chat-page__header h1 {
        margin: 0;
        font-size: 1.4rem;
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
      }

      .hint {
        margin: 6px 0 0;
        color: #64748b;
        font-size: 0.92rem;
      }

      .chat-card {
        display: flex;
        flex-direction: column;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(203, 213, 225, 0.6);
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        overflow: hidden;
        height: min(70vh, 620px);
      }

      .chat-body {
        flex: 1;
        overflow-y: auto;
        padding: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.7rem;
      }

      .chat-empty {
        color: #64748b;
        font-size: 0.9rem;
        margin: auto 0;
        text-align: center;
      }

      .chat-bubble {
        max-width: 75%;
        padding: 0.65rem 0.9rem;
        border-radius: 14px;
        font-size: 0.94rem;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .chat-bubble--user {
        align-self: flex-end;
        background: #1d4ed8;
        color: #fff;
        border-bottom-right-radius: 4px;
      }

      .chat-bubble--assistant {
        align-self: flex-start;
        background: #f1f5f9;
        color: #0f172a;
        border-bottom-left-radius: 4px;
      }

      .chat-bubble--typing {
        color: #64748b;
        font-style: italic;
      }

      .chat-bubble--failed {
        background: #fff1f2;
        color: #b91c1c;
      }

      .chat-error {
        margin: 0;
        padding: 0.6rem 1.25rem;
        color: #b91c1c;
        font-size: 0.85rem;
        background: #fff1f2;
      }

      .chat-input {
        display: flex;
        gap: 0.6rem;
        padding: 1rem;
        border-top: 1px solid rgba(203, 213, 225, 0.6);
      }

      .chat-input input {
        flex: 1;
        border: 1px solid rgba(203, 213, 225, 0.8);
        border-radius: 999px;
        padding: 0.7rem 1rem;
        font-size: 0.95rem;
      }

      .chat-input button {
        border: none;
        border-radius: 999px;
        padding: 0.7rem 1.2rem;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 800;
        background: #1d4ed8;
        color: #fff;
        cursor: pointer;
      }

      .chat-input button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      @media (max-width: 600px) {
        .chat-card {
          height: min(75vh, 560px);
          border-radius: 14px;
        }
        .chat-bubble {
          max-width: 88%;
        }
      }
    `
  ]
})
export class ChatPageComponent {
  private readonly ai = inject(AiService);

  readonly busy = signal(false);
  readonly error = signal('');
  readonly messages = signal<ChatDisplayMessage[]>([]);
  borrador = '';

  @ViewChild('scrollAnchor') private scrollAnchor?: ElementRef<HTMLDivElement>;

  async enviar(): Promise<void> {
    const texto = this.borrador.trim();
    if (!texto || this.busy()) return;

    this.borrador = '';
    this.error.set('');
    this.messages.update((prev) => [...prev, { role: 'user', content: texto }]);
    this.scrollToBottom();
    this.busy.set(true);

    const historial = this.messages()
      .slice(0, -1)
      .slice(-MAX_HISTORIAL_ENVIADO)
      .map(({ role, content }) => ({ role, content }));

    try {
      const res = await firstValueFrom(this.ai.chat({ message: texto, history: historial }));
      this.messages.update((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (err: any) {
      const detail = err?.error?.detail;
      this.error.set(
        typeof detail === 'string' && detail
          ? detail
          : 'No se pudo contactar al asistente. Intenta de nuevo en unos momentos.'
      );
    } finally {
      this.busy.set(false);
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    queueMicrotask(() => {
      const el = this.scrollAnchor?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
