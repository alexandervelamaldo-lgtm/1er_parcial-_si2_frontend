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
  descripcion: string;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  latitud_incidente: number;
  longitud_incidente: number;
  fecha_solicitud: string;
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

export interface Tecnico {
  id: number;
  user_id: number;
  nombre: string;
  telefono: string;
  especialidad: string;
  latitud_actual?: number | null;
  longitud_actual?: number | null;
  disponibilidad: boolean;
}

export interface Cliente {
  id: number;
  user_id: number;
  nombre: string;
  telefono: string;
  direccion: string;
  latitud?: number | null;
  longitud?: number | null;
}

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  fecha_creacion: string;
}
