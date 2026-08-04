/**
 * Adaptador de persistencia local (sin servidor).
 * Incluye soporte para Registro de Alojamiento TRA Colombia.
 */

import type {
  EstadoRegistro,
  Estancia,
  EstanciaDetallada,
  ExportAuditLog,
  Habitacion,
  Huesped,
  MetodoPago,
  MotivoViaje,
  Pago,
  RegistroAlojamiento,
  StayGuest,
  TipoHabitacion,
  TipoIdentificacion,
  Usuario,
} from '../domain/types'
import { CAPACIDAD_DEFAULT } from '../domain/types'
import { calcularNoches, hashSHA256 } from '../domain/utils'
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

const CLAVE = 'chibchacum.pms.v2'
const CLAVE_SESION = 'chibchacum.pms.sesion'

interface CuentaAlmacenada extends Usuario {
  clave_hash: string
  token_recuperacion: string | null
  token_expira: number | null
}

interface Almacen {
  usuarios: CuentaAlmacenada[]
  habitaciones: Habitacion[]
  huespedes: Huesped[]
  estancias: Estancia[]
  pagos: Pago[]
  stay_guests: StayGuest[]
  registros_alojamiento: RegistroAlojamiento[]
  export_audit_logs: ExportAuditLog[]
  secuencias: Record<string, number>
}

const almacenVacio = (): Almacen => ({
  usuarios: [],
  habitaciones: [],
  huespedes: [],
  estancias: [],
  pagos: [],
  stay_guests: [],
  registros_alojamiento: [],
  export_audit_logs: [],
  secuencias: {},
})

function leer(): Almacen {
  try {
    // Intentar leer v2 primero
    let crudo = localStorage.getItem(CLAVE)
    if (!crudo) {
      // Migrar desde v1 si existe
      const v1 = localStorage.getItem('chibchacum.pms.v1')
      if (v1) {
        const datosV1 = JSON.parse(v1) as Partial<Almacen>
        const migrado = { ...almacenVacio(), ...datosV1 }
        migrado.habitaciones = (migrado.habitaciones ?? []).map(migrarHabitacion)
        migrado.huespedes = (migrado.huespedes ?? []).map(migrarHuesped)
        migrado.registros_alojamiento = migrado.registros_alojamiento ?? []
        migrado.export_audit_logs = migrado.export_audit_logs ?? []
        return migrado
      }
      return almacenVacio()
    }
    const datos = JSON.parse(crudo) as Almacen
    return {
      ...almacenVacio(),
      ...datos,
      habitaciones: (datos.habitaciones ?? []).map(migrarHabitacion),
      huespedes: (datos.huespedes ?? []).map(migrarHuesped),
      stay_guests: datos.stay_guests ?? [],
      registros_alojamiento: datos.registros_alojamiento ?? [],
      export_audit_logs: datos.export_audit_logs ?? [],
    }
  } catch {
    return almacenVacio()
  }
}

/** Migra habitaciones antiguas: Suite → Grande, añade capacidad si falta */
function migrarHabitacion(h: Habitacion): Habitacion {
  const legacy = h as unknown as Record<string, unknown>
  const tipoRaw = String(legacy.tipo ?? 'Sencilla')
  const tipo = (tipoRaw === 'Suite' ? 'Grande' : tipoRaw) as TipoHabitacion
  const capacidad = Number(legacy.capacidad) > 0
    ? Number(legacy.capacidad)
    : CAPACIDAD_DEFAULT[tipo] ?? 1
  return { ...h, tipo, capacidad }
}

/** Migra huéspedes con formato antiguo (nombre_completo) al nuevo formato TRA */
function migrarHuesped(h: Huesped): Huesped {
  if (h.primer_nombre) return h  // ya migrado
  const legacy = h as unknown as Record<string, unknown>

  const partes = (h.nombre_completo ?? '').trim().split(/\s+/)
  const primerNombre = partes[0] ?? ''
  const primerApellido = partes.length > 2 ? partes[partes.length - 2] : (partes[1] ?? '')
  const segundoApellido = partes.length > 2 ? partes[partes.length - 1] : ''

  const tipoMap: Record<string, TipoIdentificacion> = {
    CC: 'Cédula de ciudadanía',
    CE: 'Cédula de extranjería',
    TI: 'Tarjeta de identidad',
    Pasaporte: 'Pasaporte',
    NIT: 'Otro',
    PPT: 'PEP/PPT',
  }

  return {
    ...h,
    primer_nombre: primerNombre,
    segundo_nombre: '',
    primer_apellido: primerApellido,
    segundo_apellido: segundoApellido,
    tipo_identificacion: tipoMap[String(legacy.tipo_documento ?? 'CC')] ?? 'Cédula de ciudadanía',
    numero_identificacion: String(legacy.numero_documento ?? ''),
    pais_residencia: 'Colombia',
    departamento_residencia: '',
    ciudad_residencia: String(legacy.ciudad ?? ''),
    email: String(legacy.correo ?? ''),
    tipo_documento: (legacy.tipo_identificacion as TipoIdentificacion) ?? 'Cédula de ciudadanía',
    numero_documento: String(legacy.numero_identificacion ?? legacy.numero_documento ?? ''),
    ciudad: String(legacy.ciudad_residencia ?? legacy.ciudad ?? ''),
    correo: String(legacy.email ?? legacy.correo ?? ''),
  }
}

function escribir(almacen: Almacen): void {
  localStorage.setItem(CLAVE, JSON.stringify(almacen))
}

function siguienteId(almacen: Almacen, tabla: string): number {
  const actual = almacen.secuencias[tabla] ?? 0
  const siguiente = actual + 1
  almacen.secuencias[tabla] = siguiente
  return siguiente
}

function generarGrupoId(): string {
  return `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const publico = (cuenta: CuentaAlmacenada): Usuario => ({
  id: cuenta.id,
  nombre: cuenta.nombre,
  email: cuenta.email,
  rol: cuenta.rol,
  activo: cuenta.activo,
  creado_en: cuenta.creado_en,
})

const limpio = (texto: unknown): string => String(texto ?? '').trim()

export class RepositorioLocal implements Repositorio {
  readonly etiqueta = 'Almacenamiento local del equipo'

  async inicializar(): Promise<void> {
    const almacen = leer()
    if (almacen.usuarios.length > 0) {
      // Garantizar que siempre guardamos en v2
      escribir(almacen)
      return
    }
    almacen.usuarios.push({
      id: siguienteId(almacen, 'usuarios'),
      nombre: 'Administrador',
      email: 'admin@chibchacum.co',
      rol: 'administrador',
      activo: true,
      creado_en: new Date().toISOString(),
      clave_hash: await hashSHA256('Chibchacum2026*'),
      token_recuperacion: null,
      token_expira: null,
    })
    // Datos de demostración marcados explícitamente
    await this.sembrarDatosDemo(almacen)
    escribir(almacen)
  }

  private async sembrarDatosDemo(almacen: Almacen): Promise<void> {
    // Habitaciones de demostración
    const habitaciones: Omit<Habitacion, 'id'>[] = [
      { numero: '101', tipo: 'Sencilla', capacidad: 1, precio_noche: 80000, estado: 'Disponible', observaciones: 'DEMO' },
      { numero: '102', tipo: 'Doble', capacidad: 2, precio_noche: 120000, estado: 'Disponible', observaciones: 'DEMO' },
      { numero: '201', tipo: 'Grande', capacidad: 4, precio_noche: 250000, estado: 'Disponible', observaciones: 'DEMO' },
      { numero: '202', tipo: 'Triple', capacidad: 3, precio_noche: 160000, estado: 'Disponible', observaciones: 'DEMO' },
    ]
    for (const h of habitaciones) {
      almacen.habitaciones.push({ id: siguienteId(almacen, 'habitaciones'), ...h })
    }

    // Huéspedes de demostración (formato TRA)
    const huespedesDemo = [
      {
        primer_nombre: 'DEMO — María Fernanda', segundo_nombre: '',
        primer_apellido: 'Rojas', segundo_apellido: 'Peña',
        tipo_identificacion: 'Cédula de ciudadanía' as const,
        numero_identificacion: '52987654',
        nacionalidad: 'Colombiana', fecha_nacimiento: '1988-03-14',
        pais_residencia: 'Colombia', departamento_residencia: 'Cundinamarca', ciudad_residencia: 'Bogotá',
        telefono: '3001234567', email: 'mfrojas@demo.co', direccion: 'Calle 80 # 45-12',
      },
      {
        primer_nombre: 'DEMO — Carlos Andrés', segundo_nombre: '',
        primer_apellido: 'Mendoza', segundo_apellido: 'Torres',
        tipo_identificacion: 'Cédula de ciudadanía' as const,
        numero_identificacion: '79453218',
        nacionalidad: 'Colombiana', fecha_nacimiento: '1975-07-22',
        pais_residencia: 'Colombia', departamento_residencia: 'Antioquia', ciudad_residencia: 'Medellín',
        telefono: '3109876543', email: 'ca.mendoza@demo.co', direccion: 'Carrera 43 # 65-90',
      },
      {
        primer_nombre: 'DEMO — Lena', segundo_nombre: 'Marie',
        primer_apellido: 'Schmidt', segundo_apellido: '',
        tipo_identificacion: 'Pasaporte' as const,
        numero_identificacion: 'DE7823901',
        nacionalidad: 'Alemana', fecha_nacimiento: '1993-11-05',
        pais_residencia: 'Alemania', departamento_residencia: 'Baviera', ciudad_residencia: 'Múnich',
        telefono: '+4915112345678', email: 'lena.schmidt@demo.de', direccion: 'Maximilianstr. 12',
      },
    ]

    for (const hd of huespedesDemo) {
      const nombreCompleto = [hd.primer_nombre, hd.segundo_nombre, hd.primer_apellido, hd.segundo_apellido]
        .filter(Boolean).join(' ')
      const huesped: Huesped = {
        id: siguienteId(almacen, 'huespedes'),
        ...hd,
        nombre_completo: nombreCompleto,
        tipo_documento: hd.tipo_identificacion,
        numero_documento: hd.numero_identificacion,
        ciudad: hd.ciudad_residencia,
        correo: hd.email,
        profesion: '',
        placa_vehiculo: '',
      }
      almacen.huespedes.push(huesped)
    }
  }

  // ---------------------------------------------------------------- sesión

  async iniciarSesion(email: string, clave: string): Promise<Sesion> {
    const almacen = leer()
    const cuenta = almacen.usuarios.find(
      (u) => u.email.toLowerCase() === limpio(email).toLowerCase(),
    )
    const hash = await hashSHA256(clave)
    if (!cuenta || cuenta.clave_hash !== hash) {
      throw new ErrorAplicacion('Credenciales incorrectas. Verifique correo y contraseña.')
    }
    if (!cuenta.activo) throw new ErrorAplicacion('La cuenta está inactiva. Contacte al administrador.')
    const sesion: Sesion = { usuario: publico(cuenta), token: `local.${cuenta.id}.${Date.now()}` }
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    return sesion
  }

  async cerrarSesion(): Promise<void> {
    localStorage.removeItem(CLAVE_SESION)
  }

  async sesionActual(): Promise<Sesion | null> {
    try {
      const crudo = localStorage.getItem(CLAVE_SESION)
      if (!crudo) return null
      const sesion = JSON.parse(crudo) as Sesion
      const almacen = leer()
      const vigente = almacen.usuarios.find((u) => u.id === sesion.usuario.id && u.activo)
      return vigente ? { ...sesion, usuario: publico(vigente) } : null
    } catch {
      return null
    }
  }

  async solicitarRecuperacion(email: string): Promise<string> {
    const almacen = leer()
    const cuenta = almacen.usuarios.find(
      (u) => u.email.toLowerCase() === limpio(email).toLowerCase(),
    )
    if (!cuenta) throw new ErrorAplicacion('No existe una cuenta con ese correo.')
    const token = String(Math.floor(100000 + Math.random() * 900000))
    cuenta.token_recuperacion = await hashSHA256(token)
    cuenta.token_expira = Date.now() + 30 * 60_000
    escribir(almacen)
    return token
  }

  async restablecerClave(email: string, token: string, clave: string): Promise<void> {
    if (clave.length < 8) throw new ErrorAplicacion('La contraseña debe tener al menos 8 caracteres.')
    const almacen = leer()
    const cuenta = almacen.usuarios.find(
      (u) => u.email.toLowerCase() === limpio(email).toLowerCase(),
    )
    const hashToken = await hashSHA256(limpio(token))
    if (!cuenta || cuenta.token_recuperacion !== hashToken) {
      throw new ErrorAplicacion('El código de recuperación no es válido.')
    }
    if (!cuenta.token_expira || cuenta.token_expira < Date.now()) {
      throw new ErrorAplicacion('El código de recuperación expiró. Solicite uno nuevo.')
    }
    cuenta.clave_hash = await hashSHA256(clave)
    cuenta.token_recuperacion = null
    cuenta.token_expira = null
    escribir(almacen)
  }

  async cambiarClave(actual: string, nueva: string): Promise<void> {
    const sesion = await this.sesionActual()
    if (!sesion) throw new ErrorAplicacion('Sesión no válida.')
    if (nueva.length < 8) throw new ErrorAplicacion('La nueva contraseña debe tener al menos 8 caracteres.')
    const almacen = leer()
    const cuenta = almacen.usuarios.find((u) => u.id === sesion.usuario.id)
    if (!cuenta || cuenta.clave_hash !== (await hashSHA256(actual))) {
      throw new ErrorAplicacion('La contraseña actual no es correcta.')
    }
    cuenta.clave_hash = await hashSHA256(nueva)
    escribir(almacen)
  }

  // -------------------------------------------------------------- usuarios

  async listarUsuarios(): Promise<Usuario[]> {
    return leer().usuarios.map(publico)
  }

  async crearUsuario(
    datos: Omit<Usuario, 'id' | 'creado_en'> & { clave: string },
  ): Promise<Usuario> {
    const almacen = leer()
    const email = limpio(datos.email).toLowerCase()
    if (!email.includes('@')) throw new ErrorAplicacion('Correo inválido.', { email: 'Correo inválido.' })
    if (almacen.usuarios.some((u) => u.email.toLowerCase() === email)) {
      throw new ErrorAplicacion('Ya existe un usuario con ese correo.', { email: 'Correo ya registrado.' })
    }
    if (datos.clave.length < 8) {
      throw new ErrorAplicacion('La contraseña debe tener al menos 8 caracteres.', { clave: 'Mínimo 8 caracteres.' })
    }
    const cuenta: CuentaAlmacenada = {
      id: siguienteId(almacen, 'usuarios'),
      nombre: limpio(datos.nombre),
      email,
      rol: datos.rol,
      activo: datos.activo,
      creado_en: new Date().toISOString(),
      clave_hash: await hashSHA256(datos.clave),
      token_recuperacion: null,
      token_expira: null,
    }
    almacen.usuarios.push(cuenta)
    escribir(almacen)
    return publico(cuenta)
  }

  async actualizarUsuario(id: number, datos: Partial<Usuario>): Promise<Usuario> {
    const almacen = leer()
    const cuenta = almacen.usuarios.find((u) => u.id === id)
    if (!cuenta) throw new ErrorAplicacion('Usuario no encontrado.')
    Object.assign(cuenta, {
      nombre: datos.nombre !== undefined ? limpio(datos.nombre) : cuenta.nombre,
      rol: datos.rol ?? cuenta.rol,
      activo: datos.activo ?? cuenta.activo,
    })
    escribir(almacen)
    return publico(cuenta)
  }

  async eliminarUsuario(id: number): Promise<void> {
    const almacen = leer()
    const administradores = almacen.usuarios.filter((u) => u.rol === 'administrador')
    const objetivo = almacen.usuarios.find((u) => u.id === id)
    if (objetivo?.rol === 'administrador' && administradores.length === 1) {
      throw new ErrorAplicacion('Debe existir al menos un administrador.')
    }
    almacen.usuarios = almacen.usuarios.filter((u) => u.id !== id)
    escribir(almacen)
  }

  // ----------------------------------------------------------- habitaciones

  async listarHabitaciones(): Promise<Habitacion[]> {
    return leer().habitaciones.slice().sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }))
  }

  async crearHabitacion(datos: NuevaHabitacion): Promise<Habitacion> {
    const almacen = leer()
    this.validarHabitacion(almacen, datos)
    const habitacion: Habitacion = {
      id: siguienteId(almacen, 'habitaciones'),
      numero: limpio(datos.numero),
      tipo: datos.tipo,
      capacidad: Number(datos.capacidad) >= 1 ? Number(datos.capacidad) : CAPACIDAD_DEFAULT[datos.tipo] ?? 1,
      precio_noche: Number(datos.precio_noche),
      estado: datos.estado,
      observaciones: limpio(datos.observaciones),
    }
    almacen.habitaciones.push(habitacion)
    escribir(almacen)
    return habitacion
  }

  async actualizarHabitacion(id: number, datos: Partial<NuevaHabitacion>): Promise<Habitacion> {
    const almacen = leer()
    const habitacion = almacen.habitaciones.find((h) => h.id === id)
    if (!habitacion) throw new ErrorAplicacion('Habitación no encontrada.')
    this.validarHabitacion(almacen, { ...habitacion, ...datos }, id)
    const ocupada = almacen.estancias.some((e) => e.habitacion_id === id && e.estado === 'activa')
    if (ocupada && datos.estado && datos.estado !== 'Ocupada') {
      throw new ErrorAplicacion('La habitación tiene una estancia activa; realice el check-out primero.')
    }
    // Impedir reducir capacidad por debajo de la ocupación activa del grupo TRA
    if (datos.capacidad !== undefined && ocupada) {
      const nuevaCapacidad = Number(datos.capacidad)
      const estanciaActiva = almacen.estancias.find((e) => e.habitacion_id === id && e.estado === 'activa')
      if (estanciaActiva) {
        const personas = 1 + (estanciaActiva.adultos - 1) + estanciaActiva.ninos
        if (nuevaCapacidad < personas) {
          throw new ErrorAplicacion(
            `No se puede reducir la capacidad a ${nuevaCapacidad}: la estadía activa tiene ${personas} persona(s). Realice el check-out primero.`,
            { capacidad: `Mínimo ${personas} para la estadía activa.` },
          )
        }
      }
    }
    Object.assign(habitacion, {
      numero: datos.numero !== undefined ? limpio(datos.numero) : habitacion.numero,
      tipo: datos.tipo ?? habitacion.tipo,
      capacidad: datos.capacidad !== undefined ? Math.max(1, Number(datos.capacidad)) : habitacion.capacidad,
      precio_noche: datos.precio_noche !== undefined ? Number(datos.precio_noche) : habitacion.precio_noche,
      estado: datos.estado ?? habitacion.estado,
      observaciones: datos.observaciones !== undefined ? limpio(datos.observaciones) : habitacion.observaciones,
    })
    escribir(almacen)
    return habitacion
  }

  async eliminarHabitacion(id: number): Promise<void> {
    const almacen = leer()
    if (almacen.estancias.some((e) => e.habitacion_id === id)) {
      throw new ErrorAplicacion('No se puede eliminar: la habitación tiene estancias registradas en el historial.')
    }
    almacen.habitaciones = almacen.habitaciones.filter((h) => h.id !== id)
    escribir(almacen)
  }

  private validarHabitacion(almacen: Almacen, datos: NuevaHabitacion, ignorarId?: number): void {
    const campos: Record<string, string> = {}
    if (!limpio(datos.numero)) campos.numero = 'El número es obligatorio.'
    if (almacen.habitaciones.some(
      (h) => h.id !== ignorarId && h.numero.toLowerCase() === limpio(datos.numero).toLowerCase(),
    )) {
      campos.numero = 'Ya existe una habitación con ese número.'
    }
    if (!(Number(datos.precio_noche) > 0)) campos.precio_noche = 'Ingrese un precio mayor a cero.'
    if (!(Number(datos.capacidad) >= 1)) campos.capacidad = 'La capacidad mínima es 1 persona.'
    if (Object.keys(campos).length > 0) throw new ErrorAplicacion('Revise los datos de la habitación.', campos)
  }

  // -------------------------------------------------------------- huéspedes

  async listarHuespedes(): Promise<Huesped[]> {
    return leer().huespedes.slice().sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
  }

  async crearHuesped(datos: NuevoHuesped): Promise<Huesped> {
    const almacen = leer()
    this.validarHuesped(almacen, datos)
    const huesped: Huesped = { id: siguienteId(almacen, 'huespedes'), ...this.saneaHuesped(datos) }
    almacen.huespedes.push(huesped)
    escribir(almacen)
    return huesped
  }

  async actualizarHuesped(id: number, datos: Partial<NuevoHuesped>): Promise<Huesped> {
    const almacen = leer()
    const huesped = almacen.huespedes.find((h) => h.id === id)
    if (!huesped) throw new ErrorAplicacion('Huésped no encontrado.')
    const mezclado = { ...huesped, ...datos } as NuevoHuesped
    this.validarHuesped(almacen, mezclado, id)
    Object.assign(huesped, this.saneaHuesped(mezclado))
    escribir(almacen)
    return huesped
  }

  async eliminarHuesped(id: number): Promise<void> {
    const almacen = leer()
    if (almacen.estancias.some((e) => e.huesped_id === id)) {
      throw new ErrorAplicacion('No se puede eliminar: el huésped tiene estancias en el historial.')
    }
    if (almacen.registros_alojamiento.some((r) => r.huesped_id === id)) {
      throw new ErrorAplicacion('No se puede eliminar: el huésped tiene registros TRA en el historial.')
    }
    almacen.huespedes = almacen.huespedes.filter((h) => h.id !== id)
    escribir(almacen)
  }

  private saneaHuesped(datos: NuevoHuesped): NuevoHuesped {
    const nombreCompleto = [
      limpio(datos.primer_nombre),
      limpio(datos.segundo_nombre),
      limpio(datos.primer_apellido),
      limpio(datos.segundo_apellido),
    ].filter(Boolean).join(' ')

    return {
      primer_nombre: limpio(datos.primer_nombre),
      segundo_nombre: limpio(datos.segundo_nombre),
      primer_apellido: limpio(datos.primer_apellido),
      segundo_apellido: limpio(datos.segundo_apellido),
      tipo_identificacion: datos.tipo_identificacion,
      numero_identificacion: limpio(datos.numero_identificacion),
      nacionalidad: limpio(datos.nacionalidad) || 'Colombiana',
      fecha_nacimiento: limpio(datos.fecha_nacimiento),
      pais_residencia: limpio(datos.pais_residencia) || 'Colombia',
      departamento_residencia: limpio(datos.departamento_residencia),
      ciudad_residencia: limpio(datos.ciudad_residencia),
      telefono: limpio(datos.telefono),
      email: limpio(datos.email).toLowerCase(),
      direccion: limpio(datos.direccion),
      // campos legacy sincronizados
      nombre_completo: nombreCompleto,
      tipo_documento: datos.tipo_identificacion,
      numero_documento: limpio(datos.numero_identificacion),
      ciudad: limpio(datos.ciudad_residencia),
      correo: limpio(datos.email).toLowerCase(),
      profesion: limpio(datos.profesion),
      placa_vehiculo: limpio(datos.placa_vehiculo).toUpperCase(),
    }
  }

  private validarHuesped(almacen: Almacen, datos: NuevoHuesped, ignorarId?: number): void {
    const campos: Record<string, string> = {}
    if (!limpio(datos.primer_nombre)) campos.primer_nombre = 'El primer nombre es obligatorio.'
    if (!limpio(datos.primer_apellido)) campos.primer_apellido = 'El primer apellido es obligatorio.'
    if (!limpio(datos.numero_identificacion)) campos.numero_identificacion = 'El número de documento es obligatorio.'
    if (almacen.huespedes.some(
      (h) => h.id !== ignorarId &&
        h.tipo_identificacion === datos.tipo_identificacion &&
        h.numero_identificacion === limpio(datos.numero_identificacion),
    )) {
      campos.numero_identificacion = 'Ya existe un huésped con ese documento.'
    }
    if (!limpio(datos.telefono)) campos.telefono = 'El teléfono es obligatorio.'
    if (limpio(datos.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio(datos.email))) {
      campos.email = 'Correo inválido.'
    }
    if (Object.keys(campos).length > 0) throw new ErrorAplicacion('Revise los datos del huésped.', campos)
  }

  // -------------------------------------------------- estancias y check-in

  async listarEstancias(): Promise<Estancia[]> {
    return leer().estancias.slice().sort((a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso))
  }

  async listarPagos(): Promise<Pago[]> {
    return leer().pagos.slice()
  }

  async checkIn(datos: DatosCheckIn): Promise<EstanciaDetallada> {
    const almacen = leer()
    const sesion = await this.sesionActual()
    const campos: Record<string, string> = {}

    const huesped = almacen.huespedes.find((h) => h.id === Number(datos.huesped_id))
    const habitacion = almacen.habitaciones.find((h) => h.id === Number(datos.habitacion_id))
    if (!huesped) campos.huesped_id = 'Seleccione un huésped.'
    if (!habitacion) campos.habitacion_id = 'Seleccione una habitación.'
    if (habitacion && habitacion.estado !== 'Disponible') {
      campos.habitacion_id = `La habitación ${habitacion.numero} está en estado ${habitacion.estado}.`
    }
    if (huesped && almacen.estancias.some((e) => e.huesped_id === huesped.id && e.estado === 'activa')) {
      campos.huesped_id = 'El huésped ya tiene una estancia activa.'
    }
    if (habitacion) {
      const totalPersonas = 1 + (datos.acompanantes?.length ?? 0)
      if (totalPersonas > habitacion.capacidad) {
        campos.habitacion_id = `La habitación ${habitacion.numero} tiene capacidad para ${habitacion.capacidad} persona(s) pero se están registrando ${totalPersonas}.`
      }
    }
    if (new Date(datos.fecha_salida_estimada) <= new Date(datos.fecha_ingreso)) {
      campos.fecha_salida_estimada = 'La salida debe ser posterior al ingreso.'
    }
    if (!(Number(datos.adultos) >= 1)) campos.adultos = 'Debe haber al menos un adulto.'
    if (!(Number(datos.valor_noche) > 0)) campos.valor_noche = 'Ingrese el valor por noche.'
    if (Object.keys(campos).length > 0) throw new ErrorAplicacion('Revise los datos del check-in.', campos)

    const estancia: Estancia = {
      id: siguienteId(almacen, 'estancias'),
      huesped_id: huesped!.id,
      habitacion_id: habitacion!.id,
      usuario_id: sesion?.usuario.id ?? null,
      fecha_ingreso: datos.fecha_ingreso,
      fecha_salida_estimada: datos.fecha_salida_estimada,
      fecha_salida_real: null,
      adultos: Number(datos.adultos),
      ninos: Number(datos.ninos) || 0,
      valor_noche: Number(datos.valor_noche),
      metodo_pago: datos.metodo_pago,
      observaciones: limpio(datos.observaciones),
      observaciones_salida: '',
      noches: null,
      total: null,
      estado: 'activa',
    }
    almacen.estancias.push(estancia)
    habitacion!.estado = 'Ocupada'

    const pagos: Pago[] = []
    if (Number(datos.anticipo) > 0) {
      const pago: Pago = {
        id: siguienteId(almacen, 'pagos'),
        estancia_id: estancia.id,
        monto: Number(datos.anticipo),
        metodo_pago: datos.metodo_pago,
        tipo: 'anticipo',
        referencia: `ANT-${estancia.id}`,
        fecha: datos.fecha_ingreso,
      }
      almacen.pagos.push(pago)
      pagos.push(pago)
    }

    // Auto-crear registros TRA para el huésped principal y todos los acompañantes
    const ahora = new Date().toISOString()
    const traCompleto = Boolean(datos.ciudad_procedencia)
    const grupoTRA = generarGrupoId()
    const traBase = {
      estancia_id: estancia.id,
      habitacion_id: habitacion!.id,
      grupo_id: grupoTRA,
      ciudad_procedencia: datos.ciudad_procedencia ?? '',
      motivo_viaje: (datos.motivo_viaje ?? 'Turismo') as MotivoViaje,
      check_in_at: datos.fecha_ingreso,
      check_out_at: null,
      estado_registro: (traCompleto ? 'activo' : 'borrador') as EstadoRegistro,
      motivo_anulacion: '',
      created_at: ahora,
      updated_at: ahora,
      created_by: sesion?.usuario.id ?? null,
      updated_by: sesion?.usuario.id ?? null,
    }
    almacen.registros_alojamiento.push({
      id: siguienteId(almacen, 'registros_alojamiento'),
      huesped_id: huesped!.id,
      es_huesped_principal: true,
      ...traBase,
    })

    // Crear StayGuest para el huésped principal
    almacen.stay_guests.push({
      id: siguienteId(almacen, 'stay_guests'),
      estancia_id: estancia.id,
      huesped_id: huesped!.id,
      es_huesped_principal: true,
      tipo_ocupante: 'adulto',
      relacion: '',
      relacion_otro: '',
    })

    for (const acomp of datos.acompanantes ?? []) {
      almacen.registros_alojamiento.push({
        id: siguienteId(almacen, 'registros_alojamiento'),
        huesped_id: acomp.huesped_id,
        es_huesped_principal: false,
        ...traBase,
      })
      almacen.stay_guests.push({
        id: siguienteId(almacen, 'stay_guests'),
        estancia_id: estancia.id,
        huesped_id: acomp.huesped_id,
        es_huesped_principal: false,
        tipo_ocupante: acomp.es_adulto ? 'adulto' : 'nino',
        relacion: (acomp.relacion as StayGuest['relacion']) || '',
        relacion_otro: acomp.relacion_otro ?? '',
      })
    }

    escribir(almacen)
    return { ...estancia, huesped, habitacion, pagos, pagado: pagos.reduce((s, p) => s + p.monto, 0) }
  }

  async checkOut(estanciaId: number, datos: DatosCheckOut): Promise<EstanciaDetallada> {
    const almacen = leer()
    const estancia = almacen.estancias.find((e) => e.id === estanciaId)
    if (!estancia) throw new ErrorAplicacion('Estancia no encontrada.')
    if (estancia.estado === 'finalizada') throw new ErrorAplicacion('La estancia ya fue cerrada.')
    if (new Date(datos.fecha_salida_real) <= new Date(estancia.fecha_ingreso)) {
      throw new ErrorAplicacion('La fecha de salida debe ser posterior al ingreso.', {
        fecha_salida_real: 'Fecha inválida.',
      })
    }

    const noches = calcularNoches(estancia.fecha_ingreso, datos.fecha_salida_real)
    const totalPersonas = estancia.adultos + estancia.ninos
    const total = noches * estancia.valor_noche * (totalPersonas > 0 ? totalPersonas : 1)

    estancia.fecha_salida_real = datos.fecha_salida_real
    estancia.noches = noches
    estancia.total = total
    estancia.metodo_pago = datos.metodo_pago
    estancia.observaciones_salida = limpio(datos.observaciones_salida)
    estancia.estado = 'finalizada'

    if (Number(datos.monto_pagado) > 0) {
      almacen.pagos.push({
        id: siguienteId(almacen, 'pagos'),
        estancia_id: estancia.id,
        monto: Number(datos.monto_pagado),
        metodo_pago: datos.metodo_pago,
        tipo: 'saldo',
        referencia: `SAL-${estancia.id}`,
        fecha: datos.fecha_salida_real,
      })
    }

    // Actualizar estado de registros TRA asociados
    const registrosDelGrupo = almacen.registros_alojamiento.filter(
      (r) => r.estancia_id === estanciaId && r.estado_registro === 'activo',
    )
    for (const r of registrosDelGrupo) {
      r.estado_registro = 'checkout_realizado'
      r.check_out_at = datos.fecha_salida_real
      r.updated_at = new Date().toISOString()
    }

    const habitacion = almacen.habitaciones.find((h) => h.id === estancia.habitacion_id)
    if (habitacion) habitacion.estado = datos.dejar_en_limpieza ? 'Limpieza' : 'Disponible'

    escribir(almacen)
    const pagos = almacen.pagos.filter((p) => p.estancia_id === estancia.id)
    return {
      ...estancia,
      huesped: almacen.huespedes.find((h) => h.id === estancia.huesped_id),
      habitacion,
      pagos,
      pagado: pagos.reduce((s, p) => s + p.monto, 0),
    }
  }

  async registrarPago(estanciaId: number, monto: number, metodo: MetodoPago): Promise<Pago> {
    const almacen = leer()
    const estancia = almacen.estancias.find((e) => e.id === estanciaId)
    if (!estancia) throw new ErrorAplicacion('Estancia no encontrada.')
    if (!(monto > 0)) throw new ErrorAplicacion('El monto debe ser mayor a cero.')
    const pago: Pago = {
      id: siguienteId(almacen, 'pagos'),
      estancia_id: estanciaId,
      monto,
      metodo_pago: metodo,
      tipo: estancia.estado === 'activa' ? 'anticipo' : 'saldo',
      referencia: `PAG-${estanciaId}`,
      fecha: new Date().toISOString(),
    }
    almacen.pagos.push(pago)
    escribir(almacen)
    return pago
  }

  // ---------------------------------------------- Registros Alojamiento TRA

  async listarRegistrosAlojamiento(): Promise<RegistroAlojamiento[]> {
    return leer().registros_alojamiento.slice().sort((a, b) =>
      b.check_in_at.localeCompare(a.check_in_at),
    )
  }

  async crearRegistroAlojamiento(datos: NuevoRegistroAlojamiento): Promise<RegistroAlojamiento> {
    const almacen = leer()
    const sesion = await this.sesionActual()
    const ahora = new Date().toISOString()
    const grupoId = datos.grupo_id || generarGrupoId()
    const registro: RegistroAlojamiento = {
      id: siguienteId(almacen, 'registros_alojamiento'),
      grupo_id: grupoId,
      estancia_id: datos.estancia_id,
      huesped_id: datos.huesped_id,
      habitacion_id: datos.habitacion_id,
      es_huesped_principal: datos.es_huesped_principal,
      ciudad_procedencia: datos.ciudad_procedencia,
      motivo_viaje: datos.motivo_viaje,
      check_in_at: datos.check_in_at,
      check_out_at: datos.check_out_at,
      estado_registro: datos.estado_registro,
      motivo_anulacion: datos.motivo_anulacion,
      created_at: ahora,
      updated_at: ahora,
      created_by: sesion?.usuario.id ?? null,
      updated_by: sesion?.usuario.id ?? null,
    }
    almacen.registros_alojamiento.push(registro)
    escribir(almacen)
    return registro
  }

  async actualizarRegistroAlojamiento(
    id: number,
    datos: Partial<NuevoRegistroAlojamiento>,
  ): Promise<RegistroAlojamiento> {
    const almacen = leer()
    const sesion = await this.sesionActual()
    const registro = almacen.registros_alojamiento.find((r) => r.id === id)
    if (!registro) throw new ErrorAplicacion('Registro no encontrado.')
    if (registro.estado_registro === 'anulado') {
      throw new ErrorAplicacion('No se puede modificar un registro anulado.')
    }
    Object.assign(registro, { ...datos, updated_at: new Date().toISOString(), updated_by: sesion?.usuario.id ?? null })
    escribir(almacen)
    return registro
  }

  async anularRegistroAlojamiento(id: number, motivo: string): Promise<RegistroAlojamiento> {
    const almacen = leer()
    const sesion = await this.sesionActual()
    const registro = almacen.registros_alojamiento.find((r) => r.id === id)
    if (!registro) throw new ErrorAplicacion('Registro no encontrado.')
    if (registro.estado_registro === 'checkout_realizado') {
      // Permitido anular pero requiere motivo
      if (!limpio(motivo)) throw new ErrorAplicacion('Ingrese el motivo de anulación.')
    }
    registro.estado_registro = 'anulado'
    registro.motivo_anulacion = limpio(motivo)
    registro.updated_at = new Date().toISOString()
    registro.updated_by = sesion?.usuario.id ?? null
    escribir(almacen)
    return registro
  }

  // -------------------------------------------------- Auditoría exportaciones

  async listarExportAuditLogs(): Promise<ExportAuditLog[]> {
    return leer().export_audit_logs.slice().sort((a, b) => b.generado_en.localeCompare(a.generado_en))
  }

  async registrarExportacion(datos: Omit<ExportAuditLog, 'id'>): Promise<ExportAuditLog> {
    const almacen = leer()
    const log: ExportAuditLog = { id: siguienteId(almacen, 'export_audit_logs'), ...datos }
    almacen.export_audit_logs.push(log)
    escribir(almacen)
    return log
  }
}
