/**
 * Contrato del repositorio de datos.
 * Incluye operaciones para Registro de Alojamiento TRA Colombia.
 */

import type {
  Estancia,
  EstanciaDetallada,
  ExportAuditLog,
  Habitacion,
  Huesped,
  MetodoPago,
  MotivoViaje,
  Pago,
  RegistroAlojamiento,
  Usuario,
} from '../domain/types'

export type NuevaHabitacion = Omit<Habitacion, 'id'>
export type NuevoHuesped = Omit<Huesped, 'id'>

export interface DatosAcompanante {
  huesped_id: number
  es_adulto: boolean
  relacion: string
  relacion_otro: string
}

export interface DatosCheckIn {
  huesped_id: number
  habitacion_id: number
  fecha_ingreso: string
  fecha_salida_estimada: string
  adultos: number
  ninos: number
  valor_noche: number
  metodo_pago: MetodoPago
  observaciones: string
  anticipo: number
  // Datos TRA — capturados en el check-in para crear el registro automáticamente
  ciudad_procedencia?: string
  motivo_viaje?: MotivoViaje
  // Acompañantes — uno por persona adicional en la estadía
  acompanantes?: DatosAcompanante[]
}

export interface DatosCheckOut {
  fecha_salida_real: string
  metodo_pago: MetodoPago
  observaciones_salida: string
  monto_pagado: number
  dejar_en_limpieza: boolean
}

export type NuevoRegistroAlojamiento = Omit<
  RegistroAlojamiento,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>

export interface Sesion {
  usuario: Usuario
  token: string
}

export interface FiltrosExportTRA {
  desde: string
  hasta: string
  estado?: string
  habitacion_id?: number
  nacionalidad?: string
  huesped_principal_id?: number
}

export interface Repositorio {
  readonly etiqueta: string

  iniciarSesion(email: string, clave: string): Promise<Sesion>
  cerrarSesion(): Promise<void>
  sesionActual(): Promise<Sesion | null>
  solicitarRecuperacion(email: string): Promise<string>
  restablecerClave(email: string, token: string, clave: string): Promise<void>
  cambiarClave(actual: string, nueva: string): Promise<void>

  listarUsuarios(): Promise<Usuario[]>
  crearUsuario(datos: Omit<Usuario, 'id' | 'creado_en'> & { clave: string }): Promise<Usuario>
  actualizarUsuario(id: number, datos: Partial<Usuario>): Promise<Usuario>
  eliminarUsuario(id: number): Promise<void>

  listarHabitaciones(): Promise<Habitacion[]>
  crearHabitacion(datos: NuevaHabitacion): Promise<Habitacion>
  actualizarHabitacion(id: number, datos: Partial<NuevaHabitacion>): Promise<Habitacion>
  eliminarHabitacion(id: number): Promise<void>

  listarHuespedes(): Promise<Huesped[]>
  crearHuesped(datos: NuevoHuesped): Promise<Huesped>
  actualizarHuesped(id: number, datos: Partial<NuevoHuesped>): Promise<Huesped>
  eliminarHuesped(id: number): Promise<void>

  listarEstancias(): Promise<Estancia[]>
  listarPagos(): Promise<Pago[]>
  checkIn(datos: DatosCheckIn): Promise<EstanciaDetallada>
  checkOut(estanciaId: number, datos: DatosCheckOut): Promise<EstanciaDetallada>
  registrarPago(estanciaId: number, monto: number, metodo: MetodoPago): Promise<Pago>

  // TRA
  listarRegistrosAlojamiento(): Promise<RegistroAlojamiento[]>
  crearRegistroAlojamiento(datos: NuevoRegistroAlojamiento): Promise<RegistroAlojamiento>
  actualizarRegistroAlojamiento(id: number, datos: Partial<NuevoRegistroAlojamiento>): Promise<RegistroAlojamiento>
  anularRegistroAlojamiento(id: number, motivo: string): Promise<RegistroAlojamiento>

  // Auditoría de exportaciones
  listarExportAuditLogs(): Promise<ExportAuditLog[]>
  registrarExportacion(datos: Omit<ExportAuditLog, 'id'>): Promise<ExportAuditLog>
}

export class ErrorAplicacion extends Error {
  readonly campos: Record<string, string>
  constructor(mensaje: string, campos: Record<string, string> = {}) {
    super(mensaje)
    this.name = 'ErrorAplicacion'
    this.campos = campos
  }
}
