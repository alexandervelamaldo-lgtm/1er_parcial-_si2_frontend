import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../autenticacion-acceso/auth.service';

export interface SolicitudChatMessage {
  id: number;
  solicitud_id: number;
  sender_user_id: number;
  sender_role: 'cliente' | 'tecnico';
  sender_display_name: string;
  content: string;
  created_at: string;
  read_at: string | null;
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
}
