import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Cliente, CurrentUserProfile, Notificacion, Solicitud, Tecnico } from '../models/api.models';


@Injectable({ providedIn: 'root' })
export class EmergencyApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);

  private get headers(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  getSolicitudesActivas() {
    return this.http.get<Solicitud[]>(`${environment.apiUrl}/solicitudes/activas`, {
      headers: this.headers
    });
  }

  getSolicitudes() {
    return this.http.get<Solicitud[]>(`${environment.apiUrl}/solicitudes`, {
      headers: this.headers
    });
  }

  getSolicitud(solicitudId: number) {
    return this.http.get<Solicitud>(`${environment.apiUrl}/solicitudes/${solicitudId}`, {
      headers: this.headers
    });
  }

  actualizarEstado(solicitudId: number, estadoId: number, observacion: string) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/estado`,
      { estado_id: estadoId, observacion },
      { headers: this.headers }
    );
  }

  asignarTecnico(solicitudId: number, tecnicoId: number) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/asignar`,
      { tecnico_id: tecnicoId },
      { headers: this.headers }
    );
  }

  getTecnicos() {
    return this.http.get<Tecnico[]>(`${environment.apiUrl}/tecnicos`, {
      headers: this.headers
    });
  }

  getClientes() {
    return this.http.get<Cliente[]>(`${environment.apiUrl}/clientes`, {
      headers: this.headers
    });
  }

  getNotificaciones() {
    return this.http.get<Notificacion[]>(`${environment.apiUrl}/notificaciones`, {
      headers: this.headers
    });
  }

  marcarNotificacionLeida(notificacionId: number) {
    return this.http.put<Notificacion>(
      `${environment.apiUrl}/notificaciones/${notificacionId}/leida`,
      {},
      { headers: this.headers }
    );
  }

  getMapaSolicitudes() {
    return this.http.get<Array<Record<string, string | number>>>(`${environment.apiUrl}/mapa/solicitudes-activas`, {
      headers: this.headers
    });
  }

  getPerfilActual() {
    return this.http.get<CurrentUserProfile>(`${environment.apiUrl}/auth/me`, {
      headers: this.headers
    });
  }
}
