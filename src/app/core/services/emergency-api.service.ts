import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  Cliente,
  ClienteCreatePayload,
  CurrentUserProfile,
  EstadoSolicitudOption,
  Notificacion,
  Solicitud,
  SolicitudCandidatos,
  SolicitudDetalle,
  SolicitudSeguimiento,
  Taller,
  Tecnico,
  TecnicoCreatePayload
} from '../models/api.models';


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

  getSolicitudDetalle(solicitudId: number) {
    return this.http.get<SolicitudDetalle>(`${environment.apiUrl}/solicitudes/${solicitudId}/detalle`, {
      headers: this.headers
    });
  }

  getCandidatosSolicitud(solicitudId: number) {
    return this.http.get<SolicitudCandidatos>(`${environment.apiUrl}/solicitudes/${solicitudId}/candidatos`, {
      headers: this.headers
    });
  }

  getSeguimientoSolicitud(solicitudId: number) {
    return this.http.get<SolicitudSeguimiento>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/seguimiento`,
      { headers: this.headers }
    );
  }

  getEstadosSolicitud() {
    return this.http.get<EstadoSolicitudOption[]>(`${environment.apiUrl}/solicitudes/estados`, {
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

  asignarTecnico(solicitudId: number, tecnicoId?: number | null, tallerId?: number | null) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/asignar`,
      { tecnico_id: tecnicoId, taller_id: tallerId ?? null },
      { headers: this.headers }
    );
  }

  responderAsignacion(solicitudId: number, aceptada: boolean, observacion: string) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/responder-asignacion`,
      { aceptada, observacion },
      { headers: this.headers }
    );
  }

  responderAsignacionTaller(solicitudId: number, aceptada: boolean, observacion: string) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/respuesta-taller`,
      { aceptada, observacion },
      { headers: this.headers }
    );
  }

  responderPropuestaCliente(solicitudId: number, aprobada: boolean, observacion: string) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/respuesta-cliente`,
      { aprobada, observacion },
      { headers: this.headers }
    );
  }

  revisarManual(solicitudId: number, confianza: number, prioridad: string, resumenIa: string, motivoPrioridad: string) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/revision-manual`,
      {
        confianza,
        prioridad,
        resumen_ia: resumenIa,
        motivo_prioridad: motivoPrioridad
      },
      { headers: this.headers }
    );
  }

  cancelarSolicitud(solicitudId: number, observacion: string) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/cancelar`,
      { observacion },
      { headers: this.headers }
    );
  }

  getTecnicos() {
    return this.http.get<Tecnico[]>(`${environment.apiUrl}/tecnicos`, {
      headers: this.headers
    });
  }

  createTecnico(payload: TecnicoCreatePayload) {
    return this.http.post<Tecnico>(`${environment.apiUrl}/tecnicos`, payload, {
      headers: this.headers
    });
  }

  getMiTaller() {
    return this.http.get<Taller>(`${environment.apiUrl}/talleres/mi-taller`, {
      headers: this.headers
    });
  }

  getClientes() {
    return this.http.get<Cliente[]>(`${environment.apiUrl}/clientes`, {
      headers: this.headers
    });
  }

  createCliente(payload: ClienteCreatePayload) {
    return this.http.post<Cliente>(`${environment.apiUrl}/clientes`, payload, {
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

  registrarDeviceToken(token: string, plataforma = 'web') {
    return this.http.post<void>(
      `${environment.apiUrl}/notificaciones/device-token`,
      { token, plataforma },
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
