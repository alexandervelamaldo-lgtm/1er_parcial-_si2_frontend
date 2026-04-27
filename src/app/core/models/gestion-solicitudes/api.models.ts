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
  fecha_solicitud: string;
  fecha_asignacion?: string | null;
  fecha_atencion?: string | null;
  fecha_cierre?: string | null;
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
  ubicacion_actualizada_en?: string | null;
}

export interface TecnicoCandidato {
  id: number;
  nombre: string;
  telefono: string;
  especialidad: string;
  disponibilidad: boolean;
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
  capacidad: number;
  servicios?: string[];
  disponible?: boolean;
  acepta_automaticamente?: boolean;
  distancia_km?: number | null;
  score?: number | null;
  match_especializacion?: boolean;
  motivo_sugerencia?: string | null;
}

export interface SolicitudCandidatos {
  solicitud_id: number;
  hay_cobertura: boolean;
  mensaje?: string | null;
  talleres: Taller[];
  tecnicos: TecnicoCandidato[];
}

export interface SolicitudSeguimiento {
  solicitud_id: number;
  estado: string;
  taller_nombre?: string | null;
  tecnico_id?: number | null;
  tecnico_nombre?: string | null;
  latitud_actual?: number | null;
  longitud_actual?: number | null;
  distancia_km?: number | null;
  eta_min?: number | null;
  ubicacion_actualizada_en?: string | null;
  ubicacion_desactualizada?: boolean;
  tracking_activo?: boolean;
  sin_senal?: boolean;
  requiere_compartir_ubicacion?: boolean;
  cliente_aprobada?: boolean | null;
  propuesta_expira_en?: string | null;
  propuesta_expirada?: boolean;
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
}

