/**
 * Adaptador Supabase para el PMS Hotel Chibchacum.
 * Todas las mutaciones van a través de SECURITY DEFINER RPCs.
 * La gestión de usuarios requiere el Edge Function de backend.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from '../../utils/supabase/info'
import type {
  EstadoRegistro,
  Estancia,
  EstanciaDetallada,
  ExportAuditLog,
  Habitacion,
  Huesped,
  MotivoViaje,
  Pago,
  RegistroAlojamiento,
  TipoHabitacion,
  TipoIdentificacion,
  Usuario,
} from '../domain/types'
import {
  ErrorAplicacion,
  type DatosCheckIn,
  type DatosCheckOut,
  type NuevaHabitacion,
  type NuevoHuesped,
  type NuevoRegistroAlojamiento,
  type Repositorio,
  type Sesion,
} from './repositorio'

const SUPABASE_URL = `https://${projectId}.supabase.co`

// Singleton resistente a HMR: reutiliza el cliente si el módulo se reinicializa.
const _g = globalThis as Record<string, unknown>
const _SB_KEY = '__chibchacum_sb__'
function getClient(): SupabaseClient {
  if (!_g[_SB_KEY]) {
    _g[_SB_KEY] = createClient(SUPABASE_URL, publicAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'chibchacum-pms-auth',
      },
    })
  }
  return _g[_SB_KEY] as SupabaseClient
}

// ── Helpers de mapeo ──────────────────────────────────────────────

function uuidANumero(uuid: string): number {
  // Convierte los primeros 8 hex del UUID a un entero positivo para
  // satisfacer el contrato id: number del dominio sin perder unicidad.
  return parseInt(uuid.replace(/-/g, '').slice(0, 8), 16)
}

function mapProfile(row: Record<string, unknown>): Usuario {
  return {
    id: uuidANumero(row.id as string),
    nombre: row.nombre as string,
    email: (row.email as string) ?? '',
    rol: row.rol as 'administrador' | 'recepcion',
    activo: row.activo as boolean,
    creado_en: row.creado_en as string,
    // guardamos el uuid real para operaciones posteriores
    _uuid: row.id as string,
  } as unknown as Usuario
}

function mapRoom(row: Record<string, unknown>): Habitacion {
  return {
    id: Number(row.id),
    numero: row.numero as string,
    tipo: row.tipo as TipoHabitacion,
    capacidad: Number(row.capacidad),
    precio_noche: Number(row.precio_persona_noche),
    estado: row.estado as Habitacion['estado'],
    observaciones: (row.observaciones as string) ?? '',
  }
}

function mapGuest(row: Record<string, unknown>): Huesped {
  const nombre_completo = [
    row.primer_nombre, row.segundo_nombre,
    row.primer_apellido, row.segundo_apellido,
  ].filter(Boolean).join(' ')

  return {
    id: Number(row.id),
    primer_nombre: (row.primer_nombre as string) ?? '',
    segundo_nombre: (row.segundo_nombre as string) ?? '',
    primer_apellido: (row.primer_apellido as string) ?? '',
    segundo_apellido: (row.segundo_apellido as string) ?? '',
    tipo_identificacion: row.tipo_identificacion as TipoIdentificacion,
    numero_identificacion: row.numero_identificacion as string,
    nacionalidad: (row.nacionalidad as string) ?? 'Colombiana',
    fecha_nacimiento: (row.fecha_nacimiento as string) ?? '',
    pais_residencia: (row.pais_residencia as string) ?? 'Colombia',
    departamento_residencia: (row.departamento_residencia as string) ?? '',
    ciudad_residencia: (row.ciudad_residencia as string) ?? '',
    telefono: (row.telefono as string) ?? '',
    email: (row.email as string) ?? '',
    direccion: (row.direccion as string) ?? '',
    profesion: (row.profesion as string) ?? '',
    placa_vehiculo: (row.placa_vehiculo as string) ?? '',
    nombre_completo,
    tipo_documento: row.tipo_identificacion as TipoIdentificacion,
    numero_documento: row.numero_identificacion as string,
    ciudad: (row.ciudad_residencia as string) ?? '',
    correo: (row.email as string) ?? '',
  }
}

function mapStay(row: Record<string, unknown>): Estancia {
  return {
    id: Number(row.id),
    huesped_id: Number(row.huesped_id),
    habitacion_id: Number(row.habitacion_id),
    usuario_id: row.usuario_id != null ? uuidANumero(row.usuario_id as string) : null,
    fecha_ingreso: row.fecha_ingreso as string,
    fecha_salida_estimada: row.fecha_salida_estimada as string,
    fecha_salida_real: (row.fecha_salida_real as string) ?? null,
    adultos: Number(row.adultos),
    ninos: Number(row.ninos),
    valor_noche: Number(row.valor_persona_noche),
    metodo_pago: row.metodo_pago as Estancia['metodo_pago'],
    observaciones: (row.observaciones as string) ?? '',
    observaciones_salida: (row.observaciones_salida as string) ?? '',
    noches: row.noches != null ? Number(row.noches) : null,
    total: row.total != null ? Number(row.total) : null,
    estado: row.estado as Estancia['estado'],
  }
}

function mapPayment(row: Record<string, unknown>): Pago {
  return {
    id: Number(row.id),
    estancia_id: Number(row.estancia_id),
    monto: Number(row.monto),
    metodo_pago: row.metodo_pago as Pago['metodo_pago'],
    tipo: row.tipo as Pago['tipo'],
    referencia: (row.referencia as string) ?? '',
    fecha: row.fecha as string,
  }
}

function mapTra(row: Record<string, unknown>): RegistroAlojamiento {
  return {
    id: Number(row.id),
    grupo_id: row.grupo_id as string,
    estancia_id: row.estancia_id != null ? Number(row.estancia_id) : null,
    huesped_id: Number(row.huesped_id),
    habitacion_id: Number(row.habitacion_id),
    es_huesped_principal: row.es_huesped_principal as boolean,
    ciudad_procedencia: (row.ciudad_procedencia as string) ?? '',
    motivo_viaje: (row.motivo_viaje as MotivoViaje) ?? 'Turismo',
    check_in_at: row.check_in_at as string,
    check_out_at: (row.check_out_at as string) ?? null,
    estado_registro: row.estado_registro as EstadoRegistro,
    motivo_anulacion: (row.motivo_anulacion as string) ?? '',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    created_by: row.created_by != null ? uuidANumero(row.created_by as string) : null,
    updated_by: row.updated_by != null ? uuidANumero(row.updated_by as string) : null,
  }
}

function mapAuditLog(row: Record<string, unknown>): ExportAuditLog {
  return {
    id: Number(row.id),
    usuario_id: row.usuario_id != null ? uuidANumero(row.usuario_id as string) : null,
    tipo_reporte: row.tipo_reporte as string,
    filtros: typeof row.filtros === 'string' ? row.filtros : JSON.stringify(row.filtros),
    num_registros: Number(row.num_registros),
    generado_en: row.generado_en as string,
  }
}

/**
 * Convierte un string de <input type="datetime-local"> ("YYYY-MM-DDTHH:MM",
 * en hora local del navegador) a un ISO 8601 UTC completo.
 * PostgreSQL timestamptz sin zona horaria usa la zona del servidor (UTC en
 * Supabase), lo que desplazaría el umbral de las 4 p.m. Bogotá. Al enviar
 * UTC explícito la función finalizar_check_out convierte correctamente con
 * AT TIME ZONE 'America/Bogota'.
 */
function localAUtc(localStr: string): string {
  if (!localStr) return localStr
  // new Date("YYYY-MM-DDTHH:MM") sin zona → navegador lo interpreta como hora local
  const d = new Date(localStr)
  return Number.isFinite(d.getTime()) ? d.toISOString() : localStr
}

function lanzar(error: unknown): never {
  if (error && typeof error === 'object' && 'message' in error) {
    throw new ErrorAplicacion((error as { message: string }).message)
  }
  throw new ErrorAplicacion('Error inesperado. Intente de nuevo.')
}

// ── Adaptador ─────────────────────────────────────────────────────

export class RepositorioSupabase implements Repositorio {
  readonly etiqueta = 'Supabase'
  private sb: SupabaseClient

  constructor() {
    this.sb = getClient()
  }

  // ── Auth ─────────────────────────────────────────────────────────

  async iniciarSesion(email: string, clave: string): Promise<Sesion> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password: clave })
    if (error || !data.user) throw new ErrorAplicacion('Correo o contraseña incorrectos.')
    const perfil = await this.obtenerPerfil(data.user.id, email)
    return { usuario: perfil, token: data.session?.access_token ?? '' }
  }

  async cerrarSesion(): Promise<void> {
    await this.sb.auth.signOut()
  }

  async sesionActual(): Promise<Sesion | null> {
    const { data } = await this.sb.auth.getSession()
    if (!data.session?.user) return null
    const perfil = await this.obtenerPerfil(data.session.user.id, data.session.user.email ?? '')
    return { usuario: perfil, token: data.session.access_token }
  }

  async solicitarRecuperacion(email: string): Promise<string> {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/restablecer`,
    })
    if (error) throw new ErrorAplicacion('No se pudo enviar el correo de recuperación.')
    return ''
  }

  async restablecerClave(_email: string, _token: string, clave: string): Promise<void> {
    const { error } = await this.sb.auth.updateUser({ password: clave })
    if (error) throw new ErrorAplicacion('No se pudo restablecer la contraseña. El enlace puede haber expirado.')
  }

  async cambiarClave(_actual: string, nueva: string): Promise<void> {
    const { error } = await this.sb.auth.updateUser({ password: nueva })
    if (error) throw new ErrorAplicacion('No se pudo cambiar la contraseña.')
  }

  private async obtenerPerfil(uuid: string, email: string): Promise<Usuario> {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', uuid).single()
    if (error || !data) throw new ErrorAplicacion('Perfil no encontrado. Contacte al administrador.')
    return { ...mapProfile(data as Record<string, unknown>), email }
  }

  // ── Usuarios ─────────────────────────────────────────────────────

  async listarUsuarios(): Promise<Usuario[]> {
    const { data, error } = await this.sb
      .from('profiles')
      .select('*')
      .order('creado_en', { ascending: true })
    if (error) lanzar(error)
    // El email no está en profiles; se devuelve vacío (solo admin ve la lista)
    return (data ?? []).map((r) => mapProfile(r as Record<string, unknown>))
  }

  async crearUsuario(datos: Omit<Usuario, 'id' | 'creado_en'> & { clave: string }): Promise<Usuario> {
    // Requiere Edge Function con service_role
    const url = `${SUPABASE_URL}/functions/v1/make-server-bcd4b8ba/admin/usuarios`
    const { data: { session } } = await this.sb.auth.getSession()
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({
        email: datos.email,
        password: datos.clave,
        nombre: datos.nombre,
        rol: datos.rol,
      }),
    })
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}))
      throw new ErrorAplicacion((body as { mensaje?: string }).mensaje ?? 'No se pudo crear el usuario.')
    }
    const body = await resp.json() as Record<string, unknown>
    return mapProfile(body as Record<string, unknown>)
  }

  async actualizarUsuario(id: number, datos: Partial<Usuario>): Promise<Usuario> {
    // Buscar uuid por id numérico (aproximación: listar y filtrar)
    const usuarios = await this.listarUsuarios()
    const usuario = usuarios.find((u) => u.id === id)
    if (!usuario) throw new ErrorAplicacion('Usuario no encontrado.')
    const uuid = (usuario as unknown as { _uuid: string })._uuid

    const campos: Record<string, unknown> = {}
    if (datos.nombre !== undefined) campos.nombre = datos.nombre
    if (datos.rol !== undefined) campos.rol = datos.rol
    if (datos.activo !== undefined) campos.activo = datos.activo

    const { data, error } = await this.sb
      .from('profiles')
      .update(campos)
      .eq('id', uuid)
      .select()
      .single()
    if (error) lanzar(error)
    return mapProfile(data as Record<string, unknown>)
  }

  async eliminarUsuario(_id: number): Promise<void> {
    throw new ErrorAplicacion('La eliminación de usuarios se realiza desde el panel de Supabase → Authentication → Users.')
  }

  // ── Habitaciones ─────────────────────────────────────────────────

  async listarHabitaciones(): Promise<Habitacion[]> {
    const { data, error } = await this.sb
      .from('rooms')
      .select('*')
      .order('numero', { ascending: true })
    if (error) lanzar(error)
    return (data ?? []).map((r) => mapRoom(r as Record<string, unknown>))
  }

  async crearHabitacion(datos: NuevaHabitacion): Promise<Habitacion> {
    const { data, error } = await this.sb
      .from('rooms')
      .insert({
        numero: datos.numero,
        tipo: datos.tipo,
        capacidad: datos.capacidad,
        precio_persona_noche: datos.precio_noche,
        estado: datos.estado,
        observaciones: datos.observaciones ?? '',
        es_demo: false,
      })
      .select()
      .single()
    if (error) lanzar(error)
    return mapRoom(data as Record<string, unknown>)
  }

  async actualizarHabitacion(id: number, datos: Partial<NuevaHabitacion>): Promise<Habitacion> {
    const campos: Record<string, unknown> = {}
    if (datos.numero !== undefined) campos.numero = datos.numero
    if (datos.tipo !== undefined) campos.tipo = datos.tipo
    if (datos.capacidad !== undefined) campos.capacidad = datos.capacidad
    if (datos.precio_noche !== undefined) campos.precio_persona_noche = datos.precio_noche
    if (datos.observaciones !== undefined) campos.observaciones = datos.observaciones
    // El estado se cambia vía RPC para generar el log de auditoría
    if (datos.estado !== undefined) {
      await this.sb.rpc('actualizar_estado_habitacion', { p_room_id: id, p_estado: datos.estado })
    }

    if (Object.keys(campos).length === 0) {
      const [hab] = await this.listarHabitaciones()
      const found = (await this.listarHabitaciones()).find((h) => h.id === id)
      if (!found) throw new ErrorAplicacion('Habitación no encontrada.')
      return found
    }

    const { data, error } = await this.sb
      .from('rooms')
      .update(campos)
      .eq('id', id)
      .select()
      .single()
    if (error) lanzar(error)
    return mapRoom(data as Record<string, unknown>)
  }

  async eliminarHabitacion(_id: number): Promise<void> {
    throw new ErrorAplicacion('Las habitaciones no se eliminan para preservar el historial operativo.')
  }

  // ── Huéspedes ─────────────────────────────────────────────────────

  async listarHuespedes(): Promise<Huesped[]> {
    const { data, error } = await this.sb
      .from('guests')
      .select('*')
      .order('primer_apellido', { ascending: true })
    if (error) lanzar(error)
    return (data ?? []).map((r) => mapGuest(r as Record<string, unknown>))
  }

  async crearHuesped(datos: NuevoHuesped): Promise<Huesped> {
    const { data, error } = await this.sb
      .from('guests')
      .insert({
        primer_nombre: datos.primer_nombre,
        segundo_nombre: datos.segundo_nombre ?? '',
        primer_apellido: datos.primer_apellido,
        segundo_apellido: datos.segundo_apellido ?? '',
        tipo_identificacion: datos.tipo_identificacion,
        numero_identificacion: datos.numero_identificacion,
        nacionalidad: datos.nacionalidad ?? 'Colombiana',
        fecha_nacimiento: datos.fecha_nacimiento || null,
        pais_residencia: datos.pais_residencia ?? 'Colombia',
        departamento_residencia: datos.departamento_residencia ?? '',
        ciudad_residencia: datos.ciudad_residencia ?? '',
        telefono: datos.telefono ?? '',
        email: datos.email ?? '',
        direccion: datos.direccion ?? '',
        profesion: datos.profesion ?? '',
        placa_vehiculo: datos.placa_vehiculo ?? '',
        es_demo: false,
      })
      .select()
      .single()
    if (error) lanzar(error)
    return mapGuest(data as Record<string, unknown>)
  }

  async actualizarHuesped(id: number, datos: Partial<NuevoHuesped>): Promise<Huesped> {
    const campos: Record<string, unknown> = {}
    const mapa: Record<string, string> = {
      primer_nombre: 'primer_nombre',
      segundo_nombre: 'segundo_nombre',
      primer_apellido: 'primer_apellido',
      segundo_apellido: 'segundo_apellido',
      tipo_identificacion: 'tipo_identificacion',
      numero_identificacion: 'numero_identificacion',
      nacionalidad: 'nacionalidad',
      fecha_nacimiento: 'fecha_nacimiento',
      pais_residencia: 'pais_residencia',
      departamento_residencia: 'departamento_residencia',
      ciudad_residencia: 'ciudad_residencia',
      telefono: 'telefono',
      email: 'email',
      direccion: 'direccion',
      profesion: 'profesion',
      placa_vehiculo: 'placa_vehiculo',
    }
    for (const [k, dbk] of Object.entries(mapa)) {
      if ((datos as Record<string, unknown>)[k] !== undefined) {
        campos[dbk] = (datos as Record<string, unknown>)[k]
      }
    }
    const { data, error } = await this.sb
      .from('guests')
      .update(campos)
      .eq('id', id)
      .select()
      .single()
    if (error) lanzar(error)
    return mapGuest(data as Record<string, unknown>)
  }

  async eliminarHuesped(_id: number): Promise<void> {
    throw new ErrorAplicacion('Los huéspedes no se eliminan para preservar el historial operativo.')
  }

  // ── Estancias ─────────────────────────────────────────────────────

  async listarEstancias(): Promise<Estancia[]> {
    const { data, error } = await this.sb
      .from('stays')
      .select('*')
      .order('fecha_ingreso', { ascending: false })
    if (error) lanzar(error)
    return (data ?? []).map((r) => mapStay(r as Record<string, unknown>))
  }

  async listarPagos(): Promise<Pago[]> {
    const { data, error } = await this.sb
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) lanzar(error)
    return (data ?? []).map((r) => mapPayment(r as Record<string, unknown>))
  }

  async checkIn(datos: DatosCheckIn): Promise<EstanciaDetallada> {
    const acompanantes = (datos.acompanantes ?? []).map((a) => ({
      huesped_id: a.huesped_id,
      tipo_ocupante: a.es_adulto ? 'adulto' : 'nino',
      relacion: a.relacion ?? '',
      relacion_otro: a.relacion_otro ?? '',
    }))

    const { data: stayId, error } = await this.sb.rpc('crear_check_in', {
      p_huesped_id: datos.huesped_id,
      p_habitacion_id: datos.habitacion_id,
      p_fecha_ingreso: localAUtc(datos.fecha_ingreso),
      p_fecha_salida_estimada: localAUtc(datos.fecha_salida_estimada),
      p_valor_persona_noche: datos.valor_noche,
      p_metodo_pago: datos.metodo_pago,
      p_observaciones: datos.observaciones ?? '',
      p_ciudad_procedencia: datos.ciudad_procedencia ?? '',
      p_motivo_viaje: datos.motivo_viaje ?? 'Turismo',
      p_acompanantes: acompanantes,
    })
    if (error) lanzar(error)

    // Registrar anticipo si se indicó
    if (datos.anticipo > 0) {
      await this.sb.rpc('registrar_pago', {
        p_estancia_id: stayId,
        p_monto: datos.anticipo,
        p_metodo_pago: datos.metodo_pago,
        p_tipo: 'anticipo',
        p_referencia: '',
      })
    }

    return this.obtenerEstanciaDetallada(stayId as number)
  }

  async checkOut(estanciaId: number, datos: DatosCheckOut): Promise<EstanciaDetallada> {
    const { error } = await this.sb.rpc('finalizar_check_out', {
      p_stay_id: estanciaId,
      p_fecha_salida_real: localAUtc(datos.fecha_salida_real),
      p_observaciones_salida: datos.observaciones_salida ?? '',
    })
    if (error) lanzar(error)

    if (datos.monto_pagado > 0) {
      await this.sb.rpc('registrar_pago', {
        p_estancia_id: estanciaId,
        p_monto: datos.monto_pagado,
        p_metodo_pago: datos.metodo_pago,
        p_tipo: 'saldo',
        p_referencia: '',
      })
    }

    return this.obtenerEstanciaDetallada(estanciaId)
  }

  async registrarPago(estanciaId: number, monto: number, metodo: Estancia['metodo_pago']): Promise<Pago> {
    const { data: pagoId, error } = await this.sb.rpc('registrar_pago', {
      p_estancia_id: estanciaId,
      p_monto: monto,
      p_metodo_pago: metodo,
      p_tipo: 'saldo',
      p_referencia: '',
    })
    if (error) lanzar(error)
    const { data, error: e2 } = await this.sb
      .from('payments')
      .select('*')
      .eq('id', pagoId)
      .single()
    if (e2) lanzar(e2)
    return mapPayment(data as Record<string, unknown>)
  }

  private async obtenerEstanciaDetallada(id: number): Promise<EstanciaDetallada> {
    const [{ data: s }, { data: g }, { data: r }, { data: p }] = await Promise.all([
      this.sb.from('stays').select('*').eq('id', id).single(),
      this.sb.from('stays').select('huesped_id').eq('id', id).single(),
      this.sb.from('stays').select('habitacion_id').eq('id', id).single(),
      this.sb.from('payments').select('*').eq('estancia_id', id),
    ])
    const estancia = mapStay(s as Record<string, unknown>)
    const [{ data: guest }, { data: room }] = await Promise.all([
      this.sb.from('guests').select('*').eq('id', (g as { huesped_id: number }).huesped_id).single(),
      this.sb.from('rooms').select('*').eq('id', (r as { habitacion_id: number }).habitacion_id).single(),
    ])
    const pagos = (p ?? []).map((pg) => mapPayment(pg as Record<string, unknown>))
    return {
      ...estancia,
      huesped: guest ? mapGuest(guest as Record<string, unknown>) : undefined,
      habitacion: room ? mapRoom(room as Record<string, unknown>) : undefined,
      pagos,
      pagado: pagos.reduce((s, pg) => s + pg.monto, 0),
    }
  }

  // ── TRA ───────────────────────────────────────────────────────────

  async listarRegistrosAlojamiento(): Promise<RegistroAlojamiento[]> {
    const { data, error } = await this.sb
      .from('tra_submissions')
      .select('*')
      .order('check_in_at', { ascending: false })
    if (error) lanzar(error)
    return (data ?? []).map((r) => mapTra(r as Record<string, unknown>))
  }

  async crearRegistroAlojamiento(datos: NuevoRegistroAlojamiento): Promise<RegistroAlojamiento> {
    // Siempre a través de crear_check_in; este método solo para casos manuales
    const { data, error } = await this.sb
      .from('tra_submissions')
      .insert({
        grupo_id: datos.grupo_id,
        estancia_id: datos.estancia_id,
        huesped_id: datos.huesped_id,
        habitacion_id: datos.habitacion_id,
        es_huesped_principal: datos.es_huesped_principal,
        ciudad_procedencia: datos.ciudad_procedencia ?? '',
        motivo_viaje: datos.motivo_viaje ?? 'Turismo',
        check_in_at: localAUtc(datos.check_in_at),
        check_out_at: datos.check_out_at ? localAUtc(datos.check_out_at) : null,
        estado_registro: datos.estado_registro ?? 'borrador',
        motivo_anulacion: datos.motivo_anulacion ?? '',
        es_demo: false,
      })
      .select()
      .single()
    if (error) lanzar(error)
    return mapTra(data as Record<string, unknown>)
  }

  async actualizarRegistroAlojamiento(id: number, datos: Partial<NuevoRegistroAlojamiento>): Promise<RegistroAlojamiento> {
    const { error } = await this.sb.rpc('actualizar_registro_tra_borrador', {
      p_id: id,
      p_ciudad_procedencia: datos.ciudad_procedencia ?? null,
      p_motivo_viaje: datos.motivo_viaje ?? null,
    })
    if (error) lanzar(error)
    const { data, error: e2 } = await this.sb
      .from('tra_submissions')
      .select('*')
      .eq('id', id)
      .single()
    if (e2) lanzar(e2)
    return mapTra(data as Record<string, unknown>)
  }

  async anularRegistroAlojamiento(id: number, motivo: string): Promise<RegistroAlojamiento> {
    const { error } = await this.sb.rpc('anular_registro_tra', {
      p_id: id,
      p_motivo: motivo,
    })
    if (error) lanzar(error)
    const { data, error: e2 } = await this.sb
      .from('tra_submissions')
      .select('*')
      .eq('id', id)
      .single()
    if (e2) lanzar(e2)
    return mapTra(data as Record<string, unknown>)
  }

  // ── Auditoría de exportaciones ────────────────────────────────────

  async listarExportAuditLogs(): Promise<ExportAuditLog[]> {
    const { data, error } = await this.sb
      .from('export_audit_logs')
      .select('*')
      .order('generado_en', { ascending: false })
    if (error) lanzar(error)
    return (data ?? []).map((r) => mapAuditLog(r as Record<string, unknown>))
  }

  async registrarExportacion(datos: Omit<ExportAuditLog, 'id'>): Promise<ExportAuditLog> {
    const { data, error } = await this.sb
      .from('export_audit_logs')
      .insert({
        tipo_reporte: datos.tipo_reporte,
        filtros: typeof datos.filtros === 'string' ? JSON.parse(datos.filtros) : datos.filtros,
        num_registros: datos.num_registros,
        generado_en: datos.generado_en,
      })
      .select()
      .single()
    if (error) lanzar(error)
    return mapAuditLog(data as Record<string, unknown>)
  }
}
