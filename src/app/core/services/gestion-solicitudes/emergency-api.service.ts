import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../autenticacion-acceso/auth.service';
import { TenantService } from '../tenant/tenant.service';
import {
  CategoriaTaller,
  Cliente,
  ClienteCreatePayload,
  Cotizacion,
  CotizacionItem,
  CurrentUserProfile,
  EstadoSolicitudOption,
  KpisResumen,
  NotificationPreferences,
  Notificacion,
  Pago,
  PagoSolicitudPayload,
  Solicitud,
  SolicitudCandidatos,
  SolicitudCreatePayload,
  SolicitudDetalle,
  SolicitudSeguimiento,
  SolicitudSeleccionTallerPayload,
  SolicitudActualizarRutaPayload,
  Taller,
  TallerCreatePayload,
  TallerMapa,
  Tecnico,
  TecnicoCreatePayload,
  TipoIncidenteOption,
  TrabajoFinalizadoPayload,
  TrabajoRealizadoListResponse,
  Vehiculo,
  WebPushPublicKeyResponse,
  WebPushSubscriptionPayload
} from '../../models/gestion-solicitudes/api.models';


@Injectable({ providedIn: 'root' })
export class EmergencyApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);

  private get headers(): HttpHeaders {
    const token = this.authService.getToken();
    const tenant = this.tenantService.getTenant();
    const headers: Record<string, string> = { 'X-Tenant': tenant };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return new HttpHeaders(headers);
  }

  getSolicitudesActivas(options?: { offset?: number; limit?: number }) {
    const params = new HttpParams({
      fromObject: {
        offset: String(options?.offset ?? 0),
        limit: String(options?.limit ?? 200)
      }
    });
    return this.http.get<Solicitud[]>(`${environment.apiUrl}/solicitudes/activas`, {
      headers: this.headers,
      params
    });
  }

  getSolicitudes(options?: { offset?: number; limit?: number }) {
    const params = new HttpParams({
      fromObject: {
        offset: String(options?.offset ?? 0),
        limit: String(options?.limit ?? 200)
      }
    });
    return this.http.get<Solicitud[]>(`${environment.apiUrl}/solicitudes`, {
      headers: this.headers,
      params
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

  createSolicitud(payload: SolicitudCreatePayload) {
    return this.http.post<Solicitud>(`${environment.apiUrl}/solicitudes`, payload, {
      headers: this.headers
    });
  }

  getTiposIncidente() {
    return this.http.get<TipoIncidenteOption[]>(`${environment.apiUrl}/solicitudes/tipos-incidente`, {
      headers: this.headers
    });
  }

  getVehiculos() {
    return this.http.get<Vehiculo[]>(`${environment.apiUrl}/vehiculos`, {
      headers: this.headers
    });
  }

  seleccionarTallerSolicitud(solicitudId: number, payload: SolicitudSeleccionTallerPayload) {
    return this.http.put<Solicitud>(`${environment.apiUrl}/solicitudes/${solicitudId}/seleccionar-taller`, payload, {
      headers: this.headers
    });
  }

  actualizarRutaSolicitud(solicitudId: number, payload: SolicitudActualizarRutaPayload) {
    return this.http.put<Solicitud>(`${environment.apiUrl}/solicitudes/${solicitudId}/ruta`, payload, {
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

  actualizarEstado(solicitudId: number, estadoId: number, observacion: string, estadoNombre?: string) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/estado`,
      { estado_id: estadoId, estado_nombre: estadoNombre, observacion },
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

  registrarPagoSolicitud(solicitudId: number, payload: PagoSolicitudPayload) {
    return this.http.post<Pago>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/pago`,
      payload,
      { headers: this.headers }
    );
  }

  registrarTrabajoFinalizado(solicitudId: number, payload: TrabajoFinalizadoPayload) {
    return this.http.put<Solicitud>(
      `${environment.apiUrl}/solicitudes/${solicitudId}/trabajo-finalizado`,
      payload,
      { headers: this.headers }
    );
  }

  getFacturaSolicitudUrl(solicitudId: number) {
    const token = this.authService.getToken();
    if (!token) {
      return `${environment.apiUrl}/solicitudes/${solicitudId}/factura.pdf`;
    }
    return `${environment.apiUrl}/solicitudes/${solicitudId}/factura.pdf?access_token=${encodeURIComponent(token)}`;
  }

  getTrabajosRealizados(filters: { desde?: string | null; hasta?: string | null; tecnico_id?: number | null; taller_id?: number | null }) {
    const params: Record<string, string> = {};
    if (filters.desde) params['desde'] = filters.desde;
    if (filters.hasta) params['hasta'] = filters.hasta;
    if (filters.tecnico_id) params['tecnico_id'] = String(filters.tecnico_id);
    if (filters.taller_id) params['taller_id'] = String(filters.taller_id);
    return this.http.get<TrabajoRealizadoListResponse>(`${environment.apiUrl}/solicitudes/trabajos`, {
      headers: this.headers,
      params
    });
  }

  private buildTrabajosExportUrl(
    extension: 'pdf' | 'csv',
    filters: { desde?: string | null; hasta?: string | null; tecnico_id?: number | null; taller_id?: number | null }
  ) {
    const token = this.authService.getToken();
    const params = new URLSearchParams();
    if (token) params.set('access_token', token);
    if (filters.desde) params.set('desde', filters.desde);
    if (filters.hasta) params.set('hasta', filters.hasta);
    if (filters.tecnico_id) params.set('tecnico_id', String(filters.tecnico_id));
    if (filters.taller_id) params.set('taller_id', String(filters.taller_id));
    const query = params.toString();
    return `${environment.apiUrl}/solicitudes/trabajos.${extension}${query ? `?${query}` : ''}`;
  }

  getTrabajosRealizadosPdfUrl(filters: { desde?: string | null; hasta?: string | null; tecnico_id?: number | null; taller_id?: number | null }) {
    return this.buildTrabajosExportUrl('pdf', filters);
  }

  getTrabajosRealizadosCsvUrl(filters: { desde?: string | null; hasta?: string | null; tecnico_id?: number | null; taller_id?: number | null }) {
    return this.buildTrabajosExportUrl('csv', filters);
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

  createTaller(payload: TallerCreatePayload) {
    return this.http.post<Taller>(`${environment.apiUrl}/talleres`, payload, {
      headers: this.headers
    });
  }

  updateTaller(tallerId: number, payload: Partial<TallerCreatePayload>) {
    return this.http.put<Taller>(`${environment.apiUrl}/talleres/${tallerId}`, payload, {
      headers: this.headers
    });
  }

  getTalleres() {
    return this.http.get<Taller[]>(`${environment.apiUrl}/talleres`, {
      headers: this.headers
    });
  }

  getCategoriasTaller() {
    return this.http.get<CategoriaTaller[]>(`${environment.apiUrl}/talleres/categorias`, {
      headers: this.headers
    });
  }

  getTalleresMapa(filters: {
    categoria_id?: number | null;
    dano_categoria?: string | null;
    marca?: string | null;
    lat?: number | null;
    lon?: number | null;
    radio?: number | null;
  }) {
    const params: Record<string, string> = {};
    if (filters.categoria_id != null) params['categoria_id'] = String(filters.categoria_id);
    if (filters.dano_categoria) params['dano_categoria'] = String(filters.dano_categoria);
    if (filters.marca) params['marca'] = String(filters.marca);
    if (filters.lat != null) params['lat'] = String(filters.lat);
    if (filters.lon != null) params['lon'] = String(filters.lon);
    if (filters.radio != null) params['radio'] = String(filters.radio);

    return this.http.get<TallerMapa[]>(`${environment.apiUrl}/talleres/mapa`, {
      headers: this.headers,
      params
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

  unregisterDeviceToken(token?: string | null) {
    const params: Record<string, string> = {};
    if (token) params['token'] = token;
    return this.http.delete<void>(`${environment.apiUrl}/notificaciones/device-token`, {
      headers: this.headers,
      params
    });
  }

  getWebPushPublicKey() {
    return this.http.get<WebPushPublicKeyResponse>(`${environment.apiUrl}/notificaciones/webpush/public-key`, {
      headers: this.headers
    });
  }

  subscribeWebPush(payload: WebPushSubscriptionPayload) {
    return this.http.post<void>(`${environment.apiUrl}/notificaciones/webpush/subscribe`, payload, {
      headers: this.headers
    });
  }

  unsubscribeWebPush() {
    return this.http.delete<void>(`${environment.apiUrl}/notificaciones/webpush/unsubscribe`, {
      headers: this.headers
    });
  }

  getNotificationPreferences() {
    return this.http.get<NotificationPreferences>(`${environment.apiUrl}/notificaciones/preferencias`, {
      headers: this.headers
    });
  }

  updateNotificationPreferences(payload: Partial<NotificationPreferences>) {
    return this.http.put<NotificationPreferences>(`${environment.apiUrl}/notificaciones/preferencias`, payload, {
      headers: this.headers
    });
  }

  getMapaSolicitudes() {
    return this.http.get<Array<Record<string, string | number>>>(`${environment.apiUrl}/mapa/solicitudes-activas`, {
      headers: this.headers
    });
  }

  getKpisResumen(desde?: string | null) {
    let params = new HttpParams();
    if (desde) {
      params = params.set('desde', desde);
    }
    return this.http.get<KpisResumen>(`${environment.apiUrl}/kpis/resumen`, {
      headers: this.headers,
      params
    });
  }

  seedDevData(confirm = 'RESET') {
    return this.http.post<{ ok: boolean }>(`${environment.apiUrl}/dev/seed`, { confirm }, { headers: this.headers });
  }

  getCotizaciones() {
    return this.http.get<Cotizacion[]>(`${environment.apiUrl}/cotizaciones`, {
      headers: this.headers
    });
  }

  getCotizacion(cotizacionId: number) {
    return this.http.get<Cotizacion>(`${environment.apiUrl}/cotizaciones/${cotizacionId}`, {
      headers: this.headers
    });
  }

  upsertCotizacionForSolicitud(solicitudId: number, payload: { items: CotizacionItem[]; moneda?: string }) {
    return this.http.put<Cotizacion>(`${environment.apiUrl}/cotizaciones/solicitudes/${solicitudId}`, payload, {
      headers: this.headers
    });
  }

  updateCotizacionEstado(cotizacionId: number, estado: string) {
    return this.http.put<Cotizacion>(
      `${environment.apiUrl}/cotizaciones/${cotizacionId}/estado`,
      { estado },
      { headers: this.headers }
    );
  }

  getPerfilActual() {
    return this.http.get<CurrentUserProfile>(`${environment.apiUrl}/auth/me`, {
      headers: this.headers
    });
  }
}
