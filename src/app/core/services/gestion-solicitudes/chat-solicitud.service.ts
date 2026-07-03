import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../autenticacion-acceso/auth.service';

export type SolicitudChatRole = 'cliente' | 'tecnico' | 'taller';

export interface SolicitudChatAudioInfo {
  content_type: string;
  duration_ms: number | null;
  size_bytes: number;
  /** URL relativa. El componente arma la absoluta con environment.apiUrl. */
  url: string;
}

export interface SolicitudChatMessage {
  id: number;
  solicitud_id: number;
  sender_user_id: number;
  sender_role: SolicitudChatRole;
  sender_display_name: string;
  content: string;
  created_at: string;
  read_at: string | null;
  audio: SolicitudChatAudioInfo | null;
}

export interface SolicitudChatHistoryResponse {
  solicitud_id: number;
  messages: SolicitudChatMessage[];
}

export interface SolicitudChatReadResponse {
  solicitud_id: number;
  marked: number;
}

/**
 * Cliente HTTP para el chat en vivo cliente ↔ técnico de una solicitud.
 * El realtime (mensajes entrantes) lo maneja TrackingService via WS.
 */
@Injectable({ providedIn: 'root' })
export class ChatSolicitudService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  listar(solicitudId: number, sinceId?: number) {
    const params = sinceId ? `?since_id=${sinceId}` : '';
    return this.http.get<SolicitudChatHistoryResponse>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/chat/messages${params}`,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  enviar(solicitudId: number, content: string) {
    return this.http.post<SolicitudChatMessage>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/chat/messages`,
      { content },
      { headers: this.auth.getAuthHeaders() }
    );
  }

  marcarLeidos(solicitudId: number) {
    return this.http.post<SolicitudChatReadResponse>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/chat/read`,
      {},
      { headers: this.auth.getAuthHeaders() }
    );
  }

  /** Sube una nota de voz (multipart) y crea el mensaje asociado. */
  enviarAudio(solicitudId: number, blob: Blob, durationMs: number | null) {
    const form = new FormData();
    const nombre = `voice-${Date.now()}.${_extensionFromMime(blob.type)}`;
    form.append('archivo', blob, nombre);
    if (durationMs && durationMs > 0) {
      form.append('duration_ms', String(Math.round(durationMs)));
    }
    // No seteamos Content-Type manualmente — el browser agrega el boundary.
    return this.http.post<SolicitudChatMessage>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/chat/audio`,
      form,
      { headers: this.auth.getAuthHeaders() }
    );
  }

  /** Convierte una URL relativa del backend en absoluta apuntando a apiUrl. */
  audioAbsoluteUrl(relative: string): string {
    if (!relative) return '';
    if (/^https?:\/\//i.test(relative)) return relative;
    const base = environment.apiUrl.replace(/\/+$/, '');
    const path = relative.startsWith('/') ? relative : `/${relative}`;
    return `${base}${path}`;
  }
}


/** Devuelve la extensión que corresponde al MIME grabado. */
function _extensionFromMime(mime: string): string {
  const base = (mime || '').split(';', 1)[0].trim().toLowerCase();
  switch (base) {
    case 'audio/webm':
      return 'webm';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/aac':
      return 'aac';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/wav':
      return 'wav';
    default:
      return 'bin';
  }
}
