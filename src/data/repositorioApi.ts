/**
 * Adaptador REST contra la API Laravel 12 (`backend/`).
 *
 * Se activa automáticamente cuando existe `VITE_API_URL` en el archivo `.env`
 * del frontend, por ejemplo `VITE_API_URL=http://192.168.1.10/api` apuntando al
 * servidor XAMPP de la red del hotel. Autentica con tokens de Laravel Sanctum.
 */

import type {
  Estancia,
  EstanciaDetallada,
  ExportAuditLog,
  Habitacion,
  Huesped,
  MetodoPago,
  Pago,
  RegistroAlojamiento,
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

const CLAVE_SESION = 'chibchacum.pms.sesion'

export class RepositorioApi implements Repositorio {
  readonly etiqueta: string

  constructor(private readonly baseUrl: string) {
    this.etiqueta = `API Laravel · ${baseUrl}`
  }

  private token(): string | null {
    try {
      const crudo = localStorage.getItem(CLAVE_SESION)
      return crudo ? (JSON.parse(crudo) as Sesion).token : null
    } catch {
      return null
    }
  }

  private async pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
    const token = this.token()
    let respuesta: Response
    try {
      respuesta = await fetch(`${this.baseUrl}${ruta}`, {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
      })
    } catch {
      throw new ErrorAplicacion(
        'No fue posible conectar con el servidor del hotel. Verifique la red local.',
      )
    }

    if (respuesta.status === 204) return undefined as T

    const cuerpo = await respuesta.json().catch(() => null)
    if (!respuesta.ok) {
      // Laravel devuelve { message, errors: { campo: [mensaje] } } en un 422.
      const campos: Record<string, string> = {}
      const errores = (cuerpo as { errors?: Record<string, string[]> } | null)?.errors
      if (errores) {
        for (const [campo, mensajes] of Object.entries(errores)) campos[campo] = mensajes[0]
      }
      if (respuesta.status === 401) localStorage.removeItem(CLAVE_SESION)
      throw new ErrorAplicacion(
        (cuerpo as { message?: string } | null)?.message ?? 'Ocurrió un error en el servidor.',
        campos,
      )
    }
    return ((cuerpo as { data?: T } | null)?.data ?? cuerpo) as T
  }

  private get = <T>(ruta: string) => this.pedir<T>(ruta)
  private post = <T>(ruta: string, cuerpo: unknown) =>
    this.pedir<T>(ruta, { method: 'POST', body: JSON.stringify(cuerpo) })
  private put = <T>(ruta: string, cuerpo: unknown) =>
    this.pedir<T>(ruta, { method: 'PUT', body: JSON.stringify(cuerpo) })
  private del = (ruta: string) => this.pedir<void>(ruta, { method: 'DELETE' })

  async iniciarSesion(email: string, clave: string): Promise<Sesion> {
    const sesion = await this.post<Sesion>('/auth/login', { email, password: clave })
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
    return sesion
  }

  async cerrarSesion(): Promise<void> {
    await this.post('/auth/logout', {}).catch(() => undefined)
    localStorage.removeItem(CLAVE_SESION)
  }

  async sesionActual(): Promise<Sesion | null> {
    const token = this.token()
    if (!token) return null
    try {
      const usuario = await this.get<Usuario>('/auth/me')
      return { usuario, token }
    } catch {
      return null
    }
  }

  async solicitarRecuperacion(email: string): Promise<string> {
    await this.post('/auth/forgot-password', { email })
    return ''
  }

  async restablecerClave(email: string, token: string, clave: string): Promise<void> {
    await this.post('/auth/reset-password', {
      email,
      token,
      password: clave,
      password_confirmation: clave,
    })
  }

  async cambiarClave(actual: string, nueva: string): Promise<void> {
    await this.put('/auth/password', {
      current_password: actual,
      password: nueva,
      password_confirmation: nueva,
    })
  }

  listarUsuarios = () => this.get<Usuario[]>('/usuarios')
  crearUsuario = (datos: Omit<Usuario, 'id' | 'creado_en'> & { clave: string }) =>
    this.post<Usuario>('/usuarios', { ...datos, password: datos.clave })
  actualizarUsuario = (id: number, datos: Partial<Usuario>) =>
    this.put<Usuario>(`/usuarios/${id}`, datos)
  eliminarUsuario = (id: number) => this.del(`/usuarios/${id}`)

  listarHabitaciones = () => this.get<Habitacion[]>('/habitaciones')
  crearHabitacion = (datos: NuevaHabitacion) => this.post<Habitacion>('/habitaciones', datos)
  actualizarHabitacion = (id: number, datos: Partial<NuevaHabitacion>) =>
    this.put<Habitacion>(`/habitaciones/${id}`, datos)
  eliminarHabitacion = (id: number) => this.del(`/habitaciones/${id}`)

  listarHuespedes = () => this.get<Huesped[]>('/huespedes')
  crearHuesped = (datos: NuevoHuesped) => this.post<Huesped>('/huespedes', datos)
  actualizarHuesped = (id: number, datos: Partial<NuevoHuesped>) =>
    this.put<Huesped>(`/huespedes/${id}`, datos)
  eliminarHuesped = (id: number) => this.del(`/huespedes/${id}`)

  listarEstancias = () => this.get<Estancia[]>('/estancias')
  listarPagos = () => this.get<Pago[]>('/pagos')
  checkIn = (datos: DatosCheckIn) => this.post<EstanciaDetallada>('/estancias/check-in', datos)
  checkOut = (id: number, datos: DatosCheckOut) =>
    this.post<EstanciaDetallada>(`/estancias/${id}/check-out`, datos)
  registrarPago = (id: number, monto: number, metodo: MetodoPago) =>
    this.post<Pago>(`/estancias/${id}/pagos`, { monto, metodo_pago: metodo })

  // TRA — delegan a la API cuando exista el endpoint
  listarRegistrosAlojamiento = () => this.get<RegistroAlojamiento[]>('/registros-alojamiento')
  crearRegistroAlojamiento = (datos: NuevoRegistroAlojamiento) =>
    this.post<RegistroAlojamiento>('/registros-alojamiento', datos)
  actualizarRegistroAlojamiento = (id: number, datos: Partial<NuevoRegistroAlojamiento>) =>
    this.put<RegistroAlojamiento>(`/registros-alojamiento/${id}`, datos)
  anularRegistroAlojamiento = (id: number, motivo: string) =>
    this.post<RegistroAlojamiento>(`/registros-alojamiento/${id}/anular`, { motivo })

  listarExportAuditLogs = () => this.get<ExportAuditLog[]>('/export-audit-logs')
  registrarExportacion = (datos: Omit<ExportAuditLog, 'id'>) =>
    this.post<ExportAuditLog>('/export-audit-logs', datos)
}
