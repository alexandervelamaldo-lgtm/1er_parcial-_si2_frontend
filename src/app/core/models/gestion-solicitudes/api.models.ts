export interface Role {
  id: number;
  name: string;
}

export interface UserProfile {
  id: number;
  email: string;
  is_active: boolean;
  roles: Role[];
}

export interface CurrentUserProfile {
  user: UserProfile;
  cliente_id?: number | null;
  tecnico_id?: number | null;
  operador_id?: number | null;
  taller_id?: number | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
  /** Tenant donde el backend encontró al usuario. El cliente debe
   *  guardarlo y enviarlo como X-Tenant en requests subsiguientes. */
  tenant_key?: string | null;
}

export interface Solicitud {
  id: number;
  cliente_id: number;
  vehiculo_id: number;
  tecnico_id?: number | null;
  taller_id?: number | null;
  tecnico?: {
    id: number;
    nombre: string;
    telefono: string;
    especialidad: string;
    disponibilidad: boolean;
  } | null;
  descripcion: string;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  latitud_incidente: number;
  longitud_incidente: number;
  es_carretera?: boolean;
  condicion_vehiculo?: string;
  nivel_riesgo?: number;
  /// Cuántos talleres consecutivos rechazaron la propuesta del cliente.
  /// Cuando llega a 3 el backend escala a operadores con notificación push.
  /// Lo lee el dashboard del operador para mostrar el widget "Solicitudes escaladas".
  taller_rechazos_consecutivos?: number;
  fecha_solicitud: string;
  fecha_asignacion?: string | null;
  fecha_atencion?: string | null;
  fecha_cierre?: string | null;
  fecha_incidente?: string | null;
  danos_descripcion?: string | null;
  ubicacion_texto?: string | null;
  categoria_dano?: string | null;
  presupuesto_aceptado?: number | null;
  ruta_osrm?: Record<string, any> | null;
  ruta_distancia_km?: number | null;
  ruta_eta_min?: number | null;
  servicio_demanda?: ServicioDemanda | null;
  clasificacion_confianza?: number | null;
  requiere_revision_manual?: boolean;
  motivo_prioridad?: string | null;
  resumen_ia?: string | null;
  etiquetas_ia?: string | null;
  transcripcion_audio?: string | null;
  transcripcion_audio_estado?: 'PROCESANDO' | 'COMPLETADA' | 'ERROR' | null;
  transcripcion_audio_error?: string | null;
  transcripcion_audio_actualizada_en?: string | null;
  proveedor_ia?: string | null;
  costo_estimado?: number | null;
  costo_estimado_min?: number | null;
  costo_estimado_max?: number | null;
  costo_estimacion_confianza?: number | null;
  costo_estimacion_nota?: string | null;
  visual_tags?: string[];
  visual_summary?: string | null;
  visual_factor?: number | null;
  visual_confidence?: number | null;
  costo_final?: number | null;
  moneda_costo?: string;
  trabajo_terminado?: boolean;
  trabajo_terminado_en?: string | null;
  trabajo_terminado_observacion?: string | null;
  cliente_aprobada?: boolean | null;
  cliente_aprobacion_observacion?: string | null;
  cliente_aprobacion_fecha?: string | null;
  propuesta_expira_en?: string | null;
  estado?: {
    id: number;
    nombre: string;
  };
  tipo_incidente?: {
    id: number;
    nombre: string;
    descripcion: string;
  };
}

export interface HistorialEvento {
  id: number;
  solicitud_id: number;
  estado_anterior: string;
  estado_nuevo: string;
  observacion: string;
  fecha_evento: string;
  usuario_id?: number | null;
}

export interface SolicitudDetalle extends Solicitud {
  historial: HistorialEvento[];
  evidencias: Evidencia[];
  pagos: Pago[];
  disputas: Disputa[];
}

export interface EstadoSolicitudOption {
  id: number;
  nombre: string;
}

export interface Tecnico {
  id: number;
  user_id: number;
  taller_id?: number | null;
  nombre: string;
  telefono: string;
  especialidad: string;
  latitud_actual?: number | null;
  longitud_actual?: number | null;
  disponibilidad: boolean;
  radio_cobertura_km?: number | null;
  en_turno?: boolean;
  ubicacion_actualizada_en?: string | null;
}

export interface TecnicoCandidato {
  id: number;
  nombre: string;
  telefono: string;
  especialidad: string;
  disponibilidad: boolean;
  en_turno?: boolean;
  radio_cobertura_km?: number | null;
  match_especialidad?: boolean;
  score?: number | null;
  detalle_match?: string | null;
  distancia_km?: number | null;
  eta_min?: number | null;
}

export interface Taller {
  id: number;
  user_id?: number | null;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono: string;
  horarios?: string | null;
  certificaciones?: string | null;
  tarifas_base?: Record<string, any>;
  descuentos_marca?: Record<string, number>;
  marca_asociada?: string | null;
  rating_promedio?: number;
  rating_total?: number;
  categoria?: CategoriaTaller | null;
  capacidad: number;
  servicios?: string[];
  disponible?: boolean;
  acepta_automaticamente?: boolean;
  distancia_km?: number | null;
  score?: number | null;
  match_especializacion?: boolean;
  motivo_sugerencia?: string | null;
}

export interface TallerCreatePayload {
  categoria_id: number;
  nombre: string;
  direccion: string;
  latitud: number;
  longitud: number;
  telefono: string;
  horarios?: string | null;
  certificaciones?: string | null;
  servicios?: string[];
  capacidad: number;
  disponible?: boolean;
  acepta_automaticamente?: boolean;
  marca_asociada?: string | null;
  email?: string | null;
  password?: string | null;
}

export interface CategoriaTaller {
  id: number;
  slug: string;
  nombre: string;
  descripcion?: string | null;
}

export interface TallerMapa extends Taller {
  presupuesto_min?: number | null;
  presupuesto_max?: number | null;
  presupuesto_descuento_min?: number | null;
  presupuesto_descuento_max?: number | null;
  descuento_porcentaje_aplicado?: number | null;
  tiempo_reparacion_horas?: number | null;
}

export interface SolicitudCandidatos {
  solicitud_id: number;
  hay_cobertura: boolean;
  mensaje?: string | null;
  talleres: Taller[];
  tecnicos: TecnicoCandidato[];
  servicio_unico?: ServicioDemanda | null;
}

export interface TipoIncidenteOption {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface SolicitudCreatePayload {
  cliente_id: number;
  vehiculo_id: number;
  taller_id?: number | null;
  tipo_incidente_id: number;
  latitud_incidente: number;
  longitud_incidente: number;
  latitud_cliente: number;
  longitud_cliente: number;
  descripcion: string;
  danos_descripcion?: string | null;
  fecha_incidente?: string | null;
  ubicacion_texto?: string | null;
  categoria_dano?: string | null;
  foto_url?: string | null;
  es_carretera?: boolean;
  condicion_vehiculo?: string;
  nivel_riesgo?: number;
}

export interface SolicitudSeleccionTallerPayload {
  taller_id: number;
  origen_lat: number;
  origen_lon: number;
  presupuesto_aceptado?: number | null;
}

export interface SolicitudActualizarRutaPayload {
  origen_lat: number;
  origen_lon: number;
}

export interface SolicitudSeguimiento {
  solicitud_id: number;
  estado: string;
  route_color?: string | null;
  servicio_id?: number | null;
  servicio_estado?: string | null;
  taller_nombre?: string | null;
  taller_id?: number | null;
  latitud_taller?: number | null;
  longitud_taller?: number | null;
  tecnico_id?: number | null;
  tecnico_nombre?: string | null;
  latitud_cliente?: number | null;
  longitud_cliente?: number | null;
  latitud_servicio?: number | null;
  longitud_servicio?: number | null;
  direccion_servicio?: string | null;
  latitud_actual?: number | null;
  longitud_actual?: number | null;
  distancia_km?: number | null;
  eta_min?: number | null;
  eta_min_lower?: number | null;
  eta_min_upper?: number | null;
  // Geometría GeoJSON (LineString) de la ruta vial taller→incidente cuando el
  // seguimiento se origina en el taller (flujo "taller sin técnico").
  ruta_seguimiento?: Record<string, any> | null;
  ubicacion_actualizada_en?: string | null;
  ubicacion_desactualizada?: boolean;
  tracking_activo?: boolean;
  sin_senal?: boolean;
  requiere_compartir_ubicacion?: boolean;
  cliente_aprobada?: boolean | null;
  propuesta_expira_en?: string | null;
  propuesta_expirada?: boolean;
  match_especialidad?: boolean;
  confirmacion_ubicacion_ok?: boolean | null;
  distancia_confirmacion_m?: number | null;
  confirmacion_ubicacion_en?: string | null;
  mensaje?: string | null;
}

export interface Evidencia {
  id: number;
  solicitud_id: number;
  usuario_id?: number | null;
  tipo: string;
  nombre_archivo?: string | null;
  contenido_texto?: string | null;
  archivo_url?: string | null;
  url?: string | null;
  mime_type?: string | null;
  tamano_bytes?: number | null;
  fecha_creacion: string;
}

export interface Pago {
  id: number;
  solicitud_id: number;
  cliente_id: number;
  taller_id?: number | null;
  monto_total: number;
  monto_comision: number;
  monto_taller: number;
  metodo_pago: string;
  estado: string;
  referencia_externa?: string | null;
  observacion?: string | null;
  fecha_creacion: string;
  fecha_pago?: string | null;
}

export interface PagoSolicitudPayload {
  monto_total?: number | null;
  metodo_pago: string;
  referencia_externa?: string | null;
  observacion?: string | null;
  confirmar_pago?: boolean;
}

export interface TrabajoFinalizadoPayload {
  costo_final: number;
  observacion: string;
  // El técnico asignado confirma su GPS contra el punto del servicio.
  // El taller sin técnico cierra desde el panel web y no comparte ubicación.
  latitud_confirmacion?: number;
  longitud_confirmacion?: number;
}

export interface TrabajoRealizadoItem {
  solicitud_id: number;
  fecha_cierre: string;
  cliente: string;
  taller: string;
  tecnico: string;
  tipo_incidente: string;
  costo_estimado?: number | null;
  costo_final: number;
  monto_total: number;
  monto_comision: number;
  monto_taller: number;
  metodo_pago: string;
  estado_pago: string;
}

export interface TrabajoRealizadoResumen {
  cantidad_trabajos: number;
  total_facturado: number;
  total_comision: number;
  total_taller: number;
  promedio_por_trabajo: number;
}

export interface TrabajoRealizadoListResponse {
  items: TrabajoRealizadoItem[];
  resumen: TrabajoRealizadoResumen;
}

export interface Disputa {
  id: number;
  solicitud_id: number;
  usuario_id: number;
  motivo: string;
  detalle: string;
  estado: string;
  resolucion?: string | null;
  fecha_creacion: string;
  fecha_resolucion?: string | null;
}

export interface Cliente {
  id: number;
  user_id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  latitud?: number | null;
  longitud?: number | null;
  user?: UserProfile | null;
  vehiculos?: Vehiculo[];
}

export interface Vehiculo {
  id?: number;
  cliente_id?: number;
  marca: string;
  modelo: string;
  anio: number;
  placa: string;
  color: string;
  tipo_combustible: string;
}

export interface ClienteCreatePayload {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
  direccion: string;
  latitud?: number | null;
  longitud?: number | null;
  vehiculo: Omit<Vehiculo, 'id' | 'cliente_id'>;
}

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  fecha_creacion: string;
}

export interface KpiZonaItem {
  lat: number;
  lng: number;
  count: number;
}

export interface KpisResumen {
  tiempo_asignacion_promedio_min: number | null;
  tiempo_llegada_promedio_min: number | null;
  incidentes_por_tipo: Record<string, number>;
  zonas_top: KpiZonaItem[];
  tasa_cancelacion: number;
}

export interface CotizacionItem {
  concepto: string;
  cantidad: number;
  precio_unitario: number;
}

export interface Cotizacion {
  id: number;
  solicitud_id: number;
  taller_id: number | null;
  tecnico_id: number | null;
  estado: string;
  items: Array<Record<string, any>>;
  total: number;
  moneda: string;
  created_at: string;
  updated_at: string;
}

export interface TecnicoCreatePayload {
  email: string;
  password: string;
  nombre: string;
  telefono: string;
  especialidad: string;
  taller_id?: number | null;
  latitud_actual?: number | null;
  longitud_actual?: number | null;
  disponibilidad?: boolean;
  radio_cobertura_km?: number | null;
  en_turno?: boolean;
}

export interface ServicioDemanda {
  id: number;
  estado: string;
  solicitud_id: number;
  taller_id?: number | null;
  tecnico_id?: number | null;
  latitud_cliente: number;
  longitud_cliente: number;
  latitud_servicio: number;
  longitud_servicio: number;
  direccion_servicio?: string | null;
  radio_busqueda_km: number;
  cobertura_tecnico_km?: number | null;
  distancia_asignacion_km?: number | null;
  eta_estimado_min?: number | null;
  score_matching?: number | null;
  match_especialidad?: boolean;
  detalle_matching?: string | null;
  confirmacion_ubicacion_ok?: boolean | null;
  distancia_confirmacion_m?: number | null;
  confirmacion_ubicacion_en?: string | null;
}

export interface WebPushPublicKeyResponse {
  publicKey: string;
}

export interface NotificationPreferences {
  disabledAll: boolean;
  disabledTypes: Record<string, boolean>;
}

export interface WebPushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: string | null;
  userAgent?: string | null;
}

