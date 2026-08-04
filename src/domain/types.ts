/**
 * Modelo de dominio del PMS Hotel Chibchacum.
 * Incluye campos para Tarjeta de Registro de Alojamiento (TRA) Colombia.
 */

export type Rol = 'administrador' | 'recepcion'

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  creado_en: string
}

export type TipoHabitacion = 'Sencilla' | 'Doble' | 'Triple' | 'Grande'
export type EstadoHabitacion = 'Disponible' | 'Ocupada' | 'Limpieza' | 'Mantenimiento'

export const TIPOS_HABITACION: TipoHabitacion[] = ['Sencilla', 'Doble', 'Triple', 'Grande']

export const CAPACIDAD_DEFAULT: Record<TipoHabitacion, number> = {
  Sencilla: 1,
  Doble: 2,
  Triple: 3,
  Grande: 4,
}
export const ESTADOS_HABITACION: EstadoHabitacion[] = [
  'Disponible',
  'Ocupada',
  'Limpieza',
  'Mantenimiento',
]

export interface Habitacion {
  id: number
  numero: string
  tipo: TipoHabitacion
  capacidad: number
  precio_noche: number
  estado: EstadoHabitacion
  observaciones: string
}

// TipoDocumento legacy — mantenido para compatibilidad con datos anteriores
export type TipoDocumento = 'CC' | 'CE' | 'TI' | 'Pasaporte' | 'NIT' | 'PPT'
export const TIPOS_DOCUMENTO: TipoDocumento[] = ['CC', 'CE', 'TI', 'Pasaporte', 'NIT', 'PPT']

// Tipos de identificación TRA Colombia (opciones completas)
export type TipoIdentificacion =
  | 'Cédula de ciudadanía'
  | 'Cédula de extranjería'
  | 'Pasaporte'
  | 'Tarjeta de identidad'
  | 'Registro civil'
  | 'PEP/PPT'
  | 'Otro'

export const TIPOS_IDENTIFICACION: TipoIdentificacion[] = [
  'Cédula de ciudadanía',
  'Cédula de extranjería',
  'Pasaporte',
  'Tarjeta de identidad',
  'Registro civil',
  'PEP/PPT',
  'Otro',
]

export interface Huesped {
  id: number
  // Campos TRA (nombre dividido)
  primer_nombre: string
  segundo_nombre: string
  primer_apellido: string
  segundo_apellido: string
  // Identificación TRA
  tipo_identificacion: TipoIdentificacion
  numero_identificacion: string
  // Ubicación de residencia TRA
  nacionalidad: string
  fecha_nacimiento: string
  pais_residencia: string
  departamento_residencia: string
  ciudad_residencia: string
  // Contacto interno (opcional)
  telefono: string
  email: string
  direccion: string
  // Campos legacy computados/almacenados para compatibilidad
  nombre_completo: string
  tipo_documento: TipoIdentificacion
  numero_documento: string
  ciudad: string
  correo: string
  // Campos adicionales
  profesion: string
  placa_vehiculo: string
}

export type RelacionAcompanante =
  | 'Esposo/a'
  | 'Hijo/a'
  | 'Nieto/a'
  | 'Sobrino/a'
  | 'Padre/Madre'
  | 'Hermano/a'
  | 'Familiar'
  | 'Amigo/a'
  | 'Pareja'
  | 'Otro'

export const RELACIONES_ACOMPANANTE: RelacionAcompanante[] = [
  'Esposo/a', 'Hijo/a', 'Nieto/a', 'Sobrino/a', 'Padre/Madre',
  'Hermano/a', 'Familiar', 'Amigo/a', 'Pareja', 'Otro',
]

/** Registro de un huésped dentro de una estadía (principal o acompañante) */
export interface StayGuest {
  id: number
  estancia_id: number
  huesped_id: number
  es_huesped_principal: boolean
  tipo_ocupante: 'adulto' | 'nino'
  relacion: RelacionAcompanante | ''
  relacion_otro: string
}

export type MotivoViaje =
  | 'Turismo'
  | 'Negocios'
  | 'Trabajo'
  | 'Salud'
  | 'Visita familiar'
  | 'Eventos'
  | 'Tránsito'
  | 'Otro'

export const MOTIVOS_VIAJE: MotivoViaje[] = [
  'Turismo',
  'Negocios',
  'Trabajo',
  'Salud',
  'Visita familiar',
  'Eventos',
  'Tránsito',
  'Otro',
]

export type EstadoRegistro = 'borrador' | 'activo' | 'checkout_realizado' | 'anulado'

export const ESTADOS_REGISTRO: { valor: EstadoRegistro; etiqueta: string }[] = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'activo', etiqueta: 'Activo' },
  { valor: 'checkout_realizado', etiqueta: 'Check-out realizado' },
  { valor: 'anulado', etiqueta: 'Anulado' },
]

/** Registro de alojamiento TRA — una fila por huésped por estadía. Campos mínimos exigidos por MinCIT. */
export interface RegistroAlojamiento {
  id: number
  grupo_id: string        // agrupa principal + acompañantes de una misma estadía
  estancia_id: number | null
  huesped_id: number
  habitacion_id: number
  es_huesped_principal: boolean

  // Datos TRA obligatorios
  ciudad_procedencia: string
  motivo_viaje: MotivoViaje
  check_in_at: string
  check_out_at: string | null

  estado_registro: EstadoRegistro
  motivo_anulacion: string

  created_at: string
  updated_at: string
  created_by: number | null
  updated_by: number | null
}

/** Log de auditoría de exportaciones CSV */
export interface ExportAuditLog {
  id: number
  usuario_id: number | null
  tipo_reporte: string
  filtros: string  // JSON serializado
  num_registros: number
  generado_en: string
}

export type MetodoPago = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Nequi' | 'Daviplata'
export const METODOS_PAGO: MetodoPago[] = [
  'Efectivo',
  'Tarjeta',
  'Transferencia',
  'Nequi',
  'Daviplata',
]

export type EstadoEstancia = 'activa' | 'finalizada'

export interface Estancia {
  id: number
  huesped_id: number
  habitacion_id: number
  usuario_id: number | null
  fecha_ingreso: string
  fecha_salida_estimada: string
  fecha_salida_real: string | null
  adultos: number
  ninos: number
  valor_noche: number
  metodo_pago: MetodoPago
  observaciones: string
  observaciones_salida: string
  noches: number | null
  total: number | null
  estado: EstadoEstancia
}

export type TipoPago = 'anticipo' | 'saldo'

export interface Pago {
  id: number
  estancia_id: number
  monto: number
  metodo_pago: MetodoPago
  tipo: TipoPago
  referencia: string
  fecha: string
}

export interface EstanciaDetallada extends Estancia {
  huesped: Huesped | undefined
  habitacion: Habitacion | undefined
  pagos: Pago[]
  pagado: number
}

export interface ResumenPanel {
  disponibles: number
  ocupadas: number
  limpieza: number
  mantenimiento: number
  huespedes_hospedados: number
  checkins_hoy: number
  checkouts_hoy: number
  ingresos_hoy: number
}

/** RegistroAlojamiento enriquecido con relaciones */
export interface RegistroDetallado extends RegistroAlojamiento {
  huesped: Huesped | undefined
  habitacion: Habitacion | undefined
  acompanantes: number
}
