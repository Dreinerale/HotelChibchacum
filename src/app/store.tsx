/**
 * Estado global de la aplicación: sesión, tema y caché de entidades.
 * Incluye registros TRA Colombia.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { prepararDatos, repositorio, usaApi } from '../data'
import type { Sesion } from '../data/repositorio'
import type {
  Estancia,
  EstanciaDetallada,
  Habitacion,
  Huesped,
  Pago,
  RegistroAlojamiento,
  RegistroDetallado,
  Usuario,
} from '../domain/types'

type Tema = 'claro' | 'oscuro'

interface Contexto {
  cargando: boolean
  usuario: Usuario | null
  esAdmin: boolean
  backend: string
  usaApi: boolean

  habitaciones: Habitacion[]
  huespedes: Huesped[]
  estancias: Estancia[]
  pagos: Pago[]
  detalladas: EstanciaDetallada[]
  activas: EstanciaDetallada[]

  registrosAlojamiento: RegistroAlojamiento[]
  registrosDetallados: RegistroDetallado[]

  tema: Tema
  alternarTema: () => void

  entrar: (email: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  refrescar: () => Promise<void>
}

// Singleton estable frente a recargas HMR: si el módulo se reinicializa,
// reutiliza el mismo objeto de contexto para que ProveedorApp y useApp
// siempre compartan la misma referencia.
const CTX_KEY = '__chibchacum_ctx__'
const g = globalThis as Record<string, unknown>
const AppContext: React.Context<Contexto | null> =
  (g[CTX_KEY] as React.Context<Contexto | null>) ??
  (g[CTX_KEY] = createContext<Contexto | null>(null))

const TEMA_CLAVE = 'chibchacum.pms.tema'

function temaInicial(): Tema {
  const guardado = localStorage.getItem(TEMA_CLAVE)
  if (guardado === 'claro' || guardado === 'oscuro') return guardado
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'
}

export function ProveedorApp({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([])
  const [huespedes, setHuespedes] = useState<Huesped[]>([])
  const [estancias, setEstancias] = useState<Estancia[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [registrosAlojamiento, setRegistrosAlojamiento] = useState<RegistroAlojamiento[]>([])
  const [tema, setTema] = useState<Tema>(temaInicial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
    localStorage.setItem(TEMA_CLAVE, tema)
  }, [tema])

  const refrescar = useCallback(async () => {
    const [hab, hue, est, pag, reg] = await Promise.all([
      repositorio.listarHabitaciones(),
      repositorio.listarHuespedes(),
      repositorio.listarEstancias(),
      repositorio.listarPagos(),
      repositorio.listarRegistrosAlojamiento(),
    ])
    setHabitaciones(hab)
    setHuespedes(hue)
    setEstancias(est)
    setPagos(pag)
    setRegistrosAlojamiento(reg)
  }, [])

  useEffect(() => {
    let vivo = true
    void (async () => {
      await prepararDatos()
      const sesion: Sesion | null = await repositorio.sesionActual()
      if (!vivo) return
      setUsuario(sesion?.usuario ?? null)
      if (sesion) await refrescar()
      if (vivo) setCargando(false)
    })()
    return () => { vivo = false }
  }, [refrescar])

  const entrar = useCallback(
    async (email: string, clave: string) => {
      const sesion = await repositorio.iniciarSesion(email, clave)
      setUsuario(sesion.usuario)
      await refrescar()
    },
    [refrescar],
  )

  const salir = useCallback(async () => {
    await repositorio.cerrarSesion()
    setUsuario(null)
    setHabitaciones([])
    setHuespedes([])
    setEstancias([])
    setPagos([])
    setRegistrosAlojamiento([])
  }, [])

  const detalladas = useMemo<EstanciaDetallada[]>(() => {
    const porHuesped = new Map(huespedes.map((h) => [h.id, h]))
    const porHabitacion = new Map(habitaciones.map((h) => [h.id, h]))
    return estancias.map((estancia) => {
      const propios = pagos.filter((p) => p.estancia_id === estancia.id)
      return {
        ...estancia,
        huesped: porHuesped.get(estancia.huesped_id),
        habitacion: porHabitacion.get(estancia.habitacion_id),
        pagos: propios,
        pagado: propios.reduce((s, p) => s + p.monto, 0),
      }
    })
  }, [estancias, huespedes, habitaciones, pagos])

  const activas = useMemo(() => detalladas.filter((e) => e.estado === 'activa'), [detalladas])

  const registrosDetallados = useMemo<RegistroDetallado[]>(() => {
    const porHuesped = new Map(huespedes.map((h) => [h.id, h]))
    const porHabitacion = new Map(habitaciones.map((h) => [h.id, h]))
    const conteoPorGrupo = new Map<string, number>()
    for (const r of registrosAlojamiento) {
      if (!r.es_huesped_principal) {
        conteoPorGrupo.set(r.grupo_id, (conteoPorGrupo.get(r.grupo_id) ?? 0) + 1)
      }
    }
    return registrosAlojamiento.map((r) => ({
      ...r,
      huesped: porHuesped.get(r.huesped_id),
      habitacion: porHabitacion.get(r.habitacion_id),
      acompanantes: conteoPorGrupo.get(r.grupo_id) ?? 0,
    }))
  }, [registrosAlojamiento, huespedes, habitaciones])

  const valor: Contexto = {
    cargando,
    usuario,
    esAdmin: usuario?.rol === 'administrador',
    backend: repositorio.etiqueta,
    usaApi,
    habitaciones,
    huespedes,
    estancias,
    pagos,
    detalladas,
    activas,
    registrosAlojamiento,
    registrosDetallados,
    tema,
    alternarTema: () => setTema((t) => (t === 'claro' ? 'oscuro' : 'claro')),
    entrar,
    salir,
    refrescar,
  }

  return <AppContext.Provider value={valor}>{children}</AppContext.Provider>
}

export function useApp(): Contexto {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp debe usarse dentro de <ProveedorApp>')
  return ctx
}
