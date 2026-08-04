/**
 * Check-in. Flujo en pasos:
 *   1. Huésped principal
 *   2. Habitación
 *   3. Acompañantes (con validación de capacidad y duplicados)
 *   4. Datos TRA (ciudad de procedencia + motivo, aplicados a todo el grupo)
 *   5. Estancia (fechas, tarifa, pago)
 * Al guardar crea la estancia, un pago de anticipo si aplica, y un registro TRA
 * por cada persona del grupo (principal + acompañantes).
 */

import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import Icono from '../components/Icono'
import {
  AreaTexto,
  Aviso,
  Boton,
  Buscador,
  Campo,
  Entrada,
  EstadoHab,
  Modal,
  Panel,
  Selector,
  Vacio,
} from '../components/ui'
import { repositorio, type NuevoHuesped } from '../data'
import { ErrorAplicacion } from '../data/repositorio'
import {
  METODOS_PAGO,
  MOTIVOS_VIAJE,
  RELACIONES_ACOMPANANTE,
  TIPOS_IDENTIFICACION,
  type Huesped,
  type MetodoPago,
  type MotivoViaje,
  type RelacionAcompanante,
  type TipoIdentificacion,
} from '../domain/types'
import { aInputLocal, calcularNoches, moneda, normalizar } from '../domain/utils'
import { huespedVacio, FormularioHuesped } from './Huespedes'

// ── Tipos internos ──────────────────────────────────────────────────────────

interface AcompananteUI {
  huesped: Huesped
  tipo: 'adulto' | 'nino'
  relacion: RelacionAcompanante | ''
  relacion_otro: string
}

interface FormNuevoAcomp {
  tipo_identificacion: TipoIdentificacion
  numero_identificacion: string
  primer_nombre: string
  segundo_nombre: string
  primer_apellido: string
  segundo_apellido: string
  ciudad_residencia: string
  tipo_ocupante: 'adulto' | 'nino'
}

const nuevoAcompVacio = (): FormNuevoAcomp => ({
  tipo_identificacion: 'Cédula de ciudadanía',
  numero_identificacion: '',
  primer_nombre: '',
  segundo_nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  ciudad_residencia: '',
  tipo_ocupante: 'adulto',
})

// ── Utilidades ───────────────────────────────────────────────────────────────

const manana = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(12, 0, 0, 0)
  return aInputLocal(d)
}

// ── Modal para agregar acompañante ──────────────────────────────────────────

function ModalAgregarAcompanante({
  huespedes,
  excluidos,
  onAgregar,
  onCerrar,
}: {
  huespedes: Huesped[]
  excluidos: Set<number>
  onAgregar: (huesped: Huesped, tipo: 'adulto' | 'nino', relacion: RelacionAcompanante | '', relacion_otro: string) => void
  onCerrar: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [modoRegistro, setModoRegistro] = useState(false)
  const [form, setForm] = useState<FormNuevoAcomp>(nuevoAcompVacio())
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState(false)
  const [tipoSeleccionado, setTipoSeleccionado] = useState<Record<number, 'adulto' | 'nino'>>({})
  const [relacionSeleccionada, setRelacionSeleccionada] = useState<Record<number, RelacionAcompanante | ''>>({})
  const [relacionOtroSeleccionado, setRelacionOtroSeleccionado] = useState<Record<number, string>>({})
  // relationship fields for new companion registration form
  const [relacion, setRelacion] = useState<RelacionAcompanante | ''>('')
  const [relacionOtro, setRelacionOtro] = useState('')

  const coincidencias = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return []
    return huespedes
      .filter(
        (h) =>
          !excluidos.has(h.id) &&
          [h.nombre_completo, h.numero_identificacion, h.telefono]
            .map(normalizar)
            .some((c) => c.includes(q)),
      )
      .slice(0, 8)
  }, [huespedes, busqueda, excluidos])

  const seleccionar = (h: Huesped) => {
    const rel = relacionSeleccionada[h.id] ?? ''
    const relOtro = rel === 'Otro' ? (relacionOtroSeleccionado[h.id] ?? '') : ''
    onAgregar(h, tipoSeleccionado[h.id] ?? 'adulto', rel, relOtro)
  }

  const registrarYAgregar = async (e: React.FormEvent) => {
    e.preventDefault()
    const campos: Record<string, string> = {}
    if (!form.primer_nombre.trim()) campos.primer_nombre = 'Obligatorio.'
    if (!form.primer_apellido.trim()) campos.primer_apellido = 'Obligatorio.'
    if (!form.numero_identificacion.trim()) campos.numero_identificacion = 'Obligatorio.'
    if (!form.ciudad_residencia.trim()) campos.ciudad_residencia = 'Obligatorio.'
    if (Object.keys(campos).length) { setErrores(campos); return }

    setOcupado(true)
    try {
      const nombreCompleto = [
        form.primer_nombre, form.segundo_nombre,
        form.primer_apellido, form.segundo_apellido,
      ].filter(Boolean).join(' ')
      const datos: NuevoHuesped = {
        ...huespedVacio,
        tipo_identificacion: form.tipo_identificacion,
        numero_identificacion: form.numero_identificacion.trim(),
        primer_nombre: form.primer_nombre.trim(),
        segundo_nombre: form.segundo_nombre.trim(),
        primer_apellido: form.primer_apellido.trim(),
        segundo_apellido: form.segundo_apellido.trim(),
        ciudad_residencia: form.ciudad_residencia.trim(),
        nombre_completo: nombreCompleto,
        tipo_documento: form.tipo_identificacion,
        numero_documento: form.numero_identificacion.trim(),
        ciudad: form.ciudad_residencia.trim(),
        telefono: '—',
      }
      const creado = await repositorio.crearHuesped(datos)
      onAgregar(creado, form.tipo_ocupante, relacion, relacion === 'Otro' ? relacionOtro : '')
    } catch (err) {
      setErrores(
        err instanceof ErrorAplicacion
          ? Object.keys(err.campos).length ? err.campos : { general: err.message }
          : { general: 'Error inesperado.' },
      )
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Modal
      abierto
      titulo={modoRegistro ? 'Registrar nuevo acompañante' : 'Agregar acompañante'}
      descripcion={
        modoRegistro
          ? 'Complete los datos básicos. Quedará guardado para futuras estancias.'
          : 'Busque un huésped existente o registre uno nuevo.'
      }
      ancho="max-w-lg"
      alCerrar={onCerrar}
    >
      {modoRegistro ? (
        <form onSubmit={registrarYAgregar} className="space-y-4 p-5">
          {errores.general ? <Aviso>{errores.general}</Aviso> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Tipo de documento" requerido>
              <Selector
                value={form.tipo_identificacion}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo_identificacion: e.target.value as TipoIdentificacion }))
                }
              >
                {TIPOS_IDENTIFICACION.map((t) => <option key={t}>{t}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Número de documento" requerido error={errores.numero_identificacion}>
              <Entrada
                autoFocus
                value={form.numero_identificacion}
                onChange={(e) => setForm((f) => ({ ...f, numero_identificacion: e.target.value }))}
                placeholder="79453218"
              />
            </Campo>
            <Campo etiqueta="Primer nombre" requerido error={errores.primer_nombre}>
              <Entrada
                value={form.primer_nombre}
                onChange={(e) => setForm((f) => ({ ...f, primer_nombre: e.target.value }))}
              />
            </Campo>
            <Campo etiqueta="Segundo nombre">
              <Entrada
                value={form.segundo_nombre}
                onChange={(e) => setForm((f) => ({ ...f, segundo_nombre: e.target.value }))}
              />
            </Campo>
            <Campo etiqueta="Primer apellido" requerido error={errores.primer_apellido}>
              <Entrada
                value={form.primer_apellido}
                onChange={(e) => setForm((f) => ({ ...f, primer_apellido: e.target.value }))}
              />
            </Campo>
            <Campo etiqueta="Segundo apellido">
              <Entrada
                value={form.segundo_apellido}
                onChange={(e) => setForm((f) => ({ ...f, segundo_apellido: e.target.value }))}
              />
            </Campo>
            <Campo etiqueta="Ciudad de residencia" requerido error={errores.ciudad_residencia} className="sm:col-span-2">
              <Entrada
                value={form.ciudad_residencia}
                onChange={(e) => setForm((f) => ({ ...f, ciudad_residencia: e.target.value }))}
                placeholder="Bogotá"
              />
            </Campo>
            <Campo etiqueta="Tipo de ocupante" className="sm:col-span-2">
              <div className="flex gap-3">
                {(['adulto', 'nino'] as const).map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="tipo_ocupante"
                      value={t}
                      checked={form.tipo_ocupante === t}
                      onChange={() => setForm((f) => ({ ...f, tipo_ocupante: t }))}
                      className="accent-primary"
                    />
                    {t === 'adulto' ? 'Adulto' : 'Niño/a'}
                  </label>
                ))}
              </div>
            </Campo>
            <Campo etiqueta="Relación con el huésped principal" className="sm:col-span-2">
              <Selector
                value={relacion}
                onChange={(e) => setRelacion(e.target.value as RelacionAcompanante | '')}
              >
                <option value="">Sin especificar</option>
                {RELACIONES_ACOMPANANTE.map((r) => <option key={r}>{r}</option>)}
              </Selector>
            </Campo>
            {relacion === 'Otro' ? (
              <Campo etiqueta="Especifique la relación" className="sm:col-span-2">
                <Entrada
                  value={relacionOtro}
                  onChange={(e) => setRelacionOtro(e.target.value)}
                  placeholder="Ej: Cuñado/a, Compañero de trabajo…"
                />
              </Campo>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Boton type="button" variante="contorno" onClick={() => setModoRegistro(false)}>
              Volver
            </Boton>
            <Boton type="submit" disabled={ocupado}>
              {ocupado ? 'Registrando…' : 'Registrar y agregar'}
            </Boton>
          </div>
        </form>
      ) : (
        <div className="space-y-3 p-5">
          <Buscador
            valor={busqueda}
            alCambiar={setBusqueda}
            marcador="Buscar por nombre, documento o teléfono…"
          />
          {busqueda && coincidencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin coincidencias.</p>
          ) : null}
          <ul className="max-h-72 divide-y divide-border overflow-y-auto">
            {coincidencias.map((h) => {
              const relH = relacionSeleccionada[h.id] ?? ''
              return (
                <li key={h.id} className="space-y-2 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{h.nombre_completo}</p>
                      <p className="num text-xs text-muted-foreground">
                        {h.tipo_identificacion} · {h.numero_identificacion}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                        value={tipoSeleccionado[h.id] ?? 'adulto'}
                        onChange={(e) =>
                          setTipoSeleccionado((prev) => ({
                            ...prev,
                            [h.id]: e.target.value as 'adulto' | 'nino',
                          }))
                        }
                      >
                        <option value="adulto">Adulto</option>
                        <option value="nino">Niño/a</option>
                      </select>
                      <Boton type="button" variante="contorno" onClick={() => seleccionar(h)}>
                        Agregar
                      </Boton>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                      value={relH}
                      onChange={(e) =>
                        setRelacionSeleccionada((prev) => ({
                          ...prev,
                          [h.id]: e.target.value as RelacionAcompanante | '',
                        }))
                      }
                    >
                      <option value="">Relación (opcional)</option>
                      {RELACIONES_ACOMPANANTE.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    {relH === 'Otro' ? (
                      <input
                        className="rounded border border-border bg-background px-2 py-1 text-xs"
                        placeholder="Especifique…"
                        value={relacionOtroSeleccionado[h.id] ?? ''}
                        onChange={(e) =>
                          setRelacionOtroSeleccionado((prev) => ({
                            ...prev,
                            [h.id]: e.target.value,
                          }))
                        }
                      />
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-border pt-3">
            <Boton
              type="button"
              variante="contorno"
              icono="mas"
              className="w-full"
              onClick={() => { setModoRegistro(true); setForm(nuevoAcompVacio()); setErrores({}) }}
            >
              Registrar nuevo acompañante
            </Boton>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function CheckIn({ alNavegar }: { alNavegar: (clave: string) => void }) {
  const { huespedes, habitaciones, activas, refrescar } = useApp()

  // Paso 1: Huésped principal
  const [busqueda, setBusqueda] = useState('')
  const [huesped, setHuesped] = useState<Huesped | null>(null)
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [nuevo, setNuevo] = useState<NuevoHuesped>(huespedVacio)
  const [erroresNuevo, setErroresNuevo] = useState<Record<string, string>>({})

  // Paso 2: Habitación
  const [habitacionId, setHabitacionId] = useState(0)

  // Paso 3: Acompañantes
  const [acompanantes, setAcompanantes] = useState<AcompananteUI[]>([])
  const [modalAcompAbierto, setModalAcompAbierto] = useState(false)
  const [acompanantesExpandidos, setAcompanantesExpandidos] = useState(false)

  // Paso 4: Datos TRA
  const [ciudadProcedencia, setCiudadProcedencia] = useState('')
  const [motivoViaje, setMotivoViaje] = useState<MotivoViaje>('Turismo')

  // Paso 5: Estancia
  const [ingreso, setIngreso] = useState(aInputLocal())
  const [salida, setSalida] = useState(manana())
  const [valorNoche, setValorNoche] = useState(0)
  const [metodo, setMetodo] = useState<MetodoPago>('Efectivo')
  const [anticipo, setAnticipo] = useState(0)
  const [observaciones, setObservaciones] = useState('')

  const [errores, setErrores] = useState<Record<string, string>>({})
  const [exito, setExito] = useState('')
  const [traStatus, setTraStatus] = useState<'activo' | 'borrador' | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const disponibles = useMemo(
    () => habitaciones.filter((h) => h.estado === 'Disponible'),
    [habitaciones],
  )

  const coincidencias = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return []
    return huespedes
      .filter((h) =>
        [h.nombre_completo, h.numero_documento, h.telefono]
          .map(normalizar)
          .some((campo) => campo.includes(q)),
      )
      .slice(0, 6)
  }, [huespedes, busqueda])

  const habitacion = habitaciones.find((h) => h.id === habitacionId)
  const capacidadMax = habitacion ? habitacion.capacidad : 0
  const ocupacionActual = (huesped ? 1 : 0) + acompanantes.length
  const cuposRestantes = capacidadMax - ocupacionActual
  const noches = calcularNoches(ingreso, salida)
  const totalPersonas = (huesped ? 1 : 0) + acompanantes.length
  const estimado = noches * valorNoche * (totalPersonas > 0 ? totalPersonas : 1)
  const yaHospedado = huesped ? activas.some((e) => e.huesped_id === huesped.id) : false

  // IDs de todos los que ya están en la estadía (para excluir en el modal)
  const excluidos = useMemo(() => {
    const s = new Set<number>()
    if (huesped) s.add(huesped.id)
    acompanantes.forEach((a) => s.add(a.huesped.id))
    return s
  }, [huesped, acompanantes])

  const elegirHabitacion = (id: number) => {
    const elegida = habitaciones.find((h) => h.id === id)
    if (!elegida) return
    // Si la nueva habitación no da capacidad para la ocupación actual, alertar
    const nuevaCapacidad = elegida.capacidad
    if (ocupacionActual > nuevaCapacidad) {
      setErrores({
        habitacion_id: `La habitación ${elegida.numero} tiene capacidad para ${nuevaCapacidad} persona(s) pero ya hay ${ocupacionActual} en el grupo. Retire acompañantes antes de cambiar a esta habitación.`,
      })
      return
    }
    setHabitacionId(id)
    setValorNoche(elegida.precio_noche)
    setErrores((e) => { const cpy = { ...e }; delete cpy.habitacion_id; return cpy })
  }

  const agregarAcompanante = async (h: Huesped, tipo: 'adulto' | 'nino', relacion: RelacionAcompanante | '', relacion_otro: string) => {
    if (excluidos.has(h.id)) return
    await refrescar()
    setAcompanantes((prev) => [...prev, { huesped: h, tipo, relacion, relacion_otro }])
    setModalAcompAbierto(false)
    setErrores((e) => { const cpy = { ...e }; delete cpy.acompanantes; return cpy })
  }

  const quitarAcompanante = (id: number) => {
    setAcompanantes((prev) => prev.filter((a) => a.huesped.id !== id))
  }

  const registrarNuevoPrincipal = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErroresNuevo({})
    try {
      const creado = await repositorio.crearHuesped(nuevo)
      await refrescar()
      setHuesped(creado)
      setBusqueda('')
      setNuevoAbierto(false)
      setNuevo(huespedVacio)
    } catch (e) {
      if (e instanceof ErrorAplicacion) {
        setErroresNuevo(Object.keys(e.campos).length ? e.campos : { general: e.message })
      }
    }
  }

  const limpiar = () => {
    setHuesped(null)
    setHabitacionId(0)
    setAcompanantes([])
    setIngreso(aInputLocal())
    setSalida(manana())
    setValorNoche(0)
    setAnticipo(0)
    setObservaciones('')
    setCiudadProcedencia('')
    setMotivoViaje('Turismo')
    setErrores({})
    setExito('')
    setTraStatus(null)
    setBusqueda('')
  }

  const guardar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const e: Record<string, string> = {}
    if (!huesped) e.huesped_id = 'Seleccione o registre un huésped.'
    if (!habitacionId) e.habitacion_id = 'Seleccione una habitación.'
    if (new Date(salida) <= new Date(ingreso)) e.fecha_salida_estimada = 'La salida debe ser posterior al ingreso.'
    if (!(valorNoche > 0)) e.valor_noche = 'Ingrese el valor por noche.'
    if (Object.keys(e).length) { setErrores(e); return }

    setErrores({})
    setExito('')
    setOcupado(true)
    try {
      const adultos = 1 + acompanantes.filter((a) => a.tipo === 'adulto').length
      const ninos = acompanantes.filter((a) => a.tipo === 'nino').length
      await repositorio.checkIn({
        huesped_id: huesped!.id,
        habitacion_id: habitacionId,
        fecha_ingreso: ingreso,
        fecha_salida_estimada: salida,
        adultos,
        ninos,
        valor_noche: valorNoche,
        metodo_pago: metodo,
        observaciones,
        anticipo,
        ciudad_procedencia: ciudadProcedencia.trim(),
        motivo_viaje: motivoViaje,
        acompanantes: acompanantes.map((a) => ({
          huesped_id: a.huesped.id,
          es_adulto: a.tipo === 'adulto',
          relacion: a.relacion,
          relacion_otro: a.relacion_otro,
        })),
      })
      await refrescar()
      const traOk = Boolean(ciudadProcedencia.trim())
      setTraStatus(traOk ? 'activo' : 'borrador')
      setExito(
        `Check-in registrado: ${huesped!.nombre_completo} en la habitación ${habitacion?.numero}.${acompanantes.length ? ` ${acompanantes.length} acompañante(s) registrado(s).` : ''} La habitación quedó en estado Ocupada.`,
      )
      limpiar()
    } catch (err) {
      if (err instanceof ErrorAplicacion) {
        setErrores(Object.keys(err.campos).length ? err.campos : { general: err.message })
      } else setErrores({ general: 'Ocurrió un error inesperado.' })
    } finally {
      setOcupado(false)
    }
  }

  if (habitaciones.length === 0 || huespedes.length === 0) {
    return (
      <div className="space-y-5">
        <header>
          <h1 className="font-serif text-3xl leading-tight">Check-in</h1>
        </header>
        <Vacio
          titulo="Falta información previa"
          mensaje={
            habitaciones.length === 0
              ? 'Registre al menos una habitación antes de hacer check-in.'
              : 'Registre al menos un huésped antes de hacer check-in.'
          }
          accion={
            <Boton onClick={() => alNavegar(habitaciones.length === 0 ? 'habitaciones' : 'huespedes')}>
              Ir a {habitaciones.length === 0 ? 'Habitaciones' : 'Huéspedes'}
            </Boton>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl leading-tight">Check-in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {disponibles.length} habitación(es) disponibles en este momento
        </p>
      </header>

      {exito ? (
        <div className="space-y-2">
          <Aviso tipo="ok">{exito}</Aviso>
          {traStatus === 'activo' ? (
            <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/8 px-4 py-2.5 text-sm text-accent">
              <Icono nombre="info" className="size-4 shrink-0" />
              Registros TRA creados y activados para todo el grupo.
            </div>
          ) : traStatus === 'borrador' ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
              <Icono nombre="info" className="size-4 shrink-0" />
              Registros TRA creados como <strong>Incompletos</strong> — falta ciudad de procedencia. Complételos en el módulo Registro TRA.
            </div>
          ) : null}
        </div>
      ) : null}
      {errores.general ? <Aviso>{errores.general}</Aviso> : null}

      <form onSubmit={guardar} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">

          {/* 1. Huésped principal */}
          <Panel
            titulo="1. Huésped principal"
            descripcion="Busque un huésped registrado o créelo aquí mismo."
            acciones={
              <Boton type="button" variante="contorno" icono="mas" onClick={() => setNuevoAbierto(true)}>
                Nuevo huésped
              </Boton>
            }
          >
            <div className="space-y-3 p-5">
              {huesped ? (
                <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-accent/35 bg-accent/8 p-4">
                  <div>
                    <p className="font-serif text-lg leading-tight">{huesped.nombre_completo}</p>
                    <p className="num mt-0.5 text-xs text-muted-foreground">
                      {huesped.tipo_documento} {huesped.numero_documento} · {huesped.telefono}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[huesped.ciudad_residencia, huesped.nacionalidad].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Boton type="button" variante="fantasma" onClick={() => { setHuesped(null); setAcompanantes([]) }}>
                    Cambiar
                  </Boton>
                </div>
              ) : (
                <>
                  <Buscador
                    valor={busqueda}
                    alCambiar={setBusqueda}
                    marcador="Buscar por nombre, documento o teléfono…"
                  />
                  {errores.huesped_id ? (
                    <p className="text-xs text-primary">{errores.huesped_id}</p>
                  ) : null}
                  {busqueda && coincidencias.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin coincidencias. Use «Nuevo huésped» para registrarlo.
                    </p>
                  ) : null}
                  <ul className="divide-y divide-border">
                    {coincidencias.map((candidato) => (
                      <li key={candidato.id}>
                        <button
                          type="button"
                          onClick={() => { setHuesped(candidato); setBusqueda('') }}
                          className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition-colors hover:text-primary"
                        >
                          <span>
                            <span className="text-sm font-medium">{candidato.nombre_completo}</span>
                            <span className="num block text-xs text-muted-foreground">
                              {candidato.tipo_documento} {candidato.numero_documento}
                            </span>
                          </span>
                          <Icono nombre="entrada" className="size-4 shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {yaHospedado ? (
                <Aviso>Este huésped ya tiene una estancia activa en el hotel.</Aviso>
              ) : null}
            </div>
          </Panel>

          {/* 2. Habitación */}
          <Panel titulo="2. Habitación" descripcion="Solo se listan habitaciones disponibles.">
            <div className="p-5">
              {disponibles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay habitaciones disponibles.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {disponibles.map((h) => {
                    const elegida = h.id === habitacionId
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => elegirHabitacion(h.id)}
                        className={`rounded-md border p-4 text-left transition-colors duration-150 ${
                          elegida
                            ? 'border-primary bg-primary/8'
                            : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="num text-2xl leading-none">{h.numero}</span>
                          <EstadoHab estado={h.estado} />
                        </div>
                        <p className="mt-2 text-sm">{h.tipo}</p>
                        <p className="num text-xs text-muted-foreground">
                          {moneda(h.precio_noche)} / persona · noche · hasta {h.capacidad} persona{h.capacidad !== 1 ? 's' : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
              {errores.habitacion_id ? (
                <p className="mt-3 text-xs text-primary">{errores.habitacion_id}</p>
              ) : null}
            </div>
          </Panel>

          {/* 3. Acompañantes */}
          <Panel
            titulo="3. Acompañantes"
            descripcion="Registra a todas las personas que se hospedarán en la habitación seleccionada."
          >
            <div className="p-5 space-y-4">
              {/* Indicador de capacidad */}
              {habitacion ? (
                <div className="flex flex-wrap items-center gap-4 rounded-md bg-secondary/60 px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">
                    Capacidad máx.{' '}
                    <span className="num font-semibold text-foreground">{capacidadMax}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Ocupación actual{' '}
                    <span className={`num font-semibold ${ocupacionActual >= capacidadMax ? 'text-primary' : 'text-foreground'}`}>
                      {ocupacionActual}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Cupos restantes{' '}
                    <span className={`num font-semibold ${cuposRestantes === 0 ? 'text-primary' : 'text-accent'}`}>
                      {cuposRestantes}
                    </span>
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Seleccione una habitación para ver la capacidad disponible.
                </p>
              )}

              {/* Lista de acompañantes */}
              {acompanantes.length > 0 ? (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {acompanantes.map((a) => (
                    <li key={a.huesped.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.huesped.nombre_completo}</p>
                        <p className="num text-xs text-muted-foreground">
                          {a.huesped.tipo_identificacion} · {a.huesped.numero_identificacion}
                        </p>
                        {a.relacion ? (
                          <p className="text-xs text-muted-foreground">
                            {a.relacion === 'Otro' && a.relacion_otro ? a.relacion_otro : a.relacion}
                          </p>
                        ) : null}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-wide uppercase ${
                        a.tipo === 'adulto'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-accent/15 text-accent'
                      }`}>
                        {a.tipo === 'adulto' ? 'Adulto' : 'Niño/a'}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-wide uppercase ${
                        a.huesped.ciudad_residencia
                          ? 'bg-accent/15 text-accent'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}>
                        TRA {a.huesped.ciudad_residencia ? '✓' : '⚠'}
                      </span>
                      <Boton
                        type="button"
                        variante="fantasma"
                        icono="basura"
                        aria-label="Quitar acompañante"
                        onClick={() => quitarAcompanante(a.huesped.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin acompañantes registrados — solo el huésped principal.
                </p>
              )}

              <Boton
                type="button"
                variante="contorno"
                icono="mas"
                disabled={!habitacion || cuposRestantes <= 0}
                onClick={() => setModalAcompAbierto(true)}
              >
                {cuposRestantes <= 0 && habitacion
                  ? 'Capacidad máxima alcanzada'
                  : '+ Agregar acompañante'}
              </Boton>

              {errores.acompanantes ? (
                <p className="text-xs text-primary">{errores.acompanantes}</p>
              ) : null}
            </div>
          </Panel>

          {/* 4. Datos TRA */}
          <Panel
            titulo="4. Datos TRA"
            descripcion="Aplican a todos en el grupo. Pueden completarse después en el módulo Registro TRA."
          >
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Campo etiqueta="Ciudad de procedencia" ayuda="Desde dónde viajó el grupo antes de llegar al hotel">
                <Entrada
                  value={ciudadProcedencia}
                  onChange={(e) => setCiudadProcedencia(e.target.value)}
                  placeholder="Bogotá, Medellín, Nueva York…"
                />
              </Campo>
              <Campo etiqueta="Motivo del viaje">
                <Selector
                  value={motivoViaje}
                  onChange={(e) => setMotivoViaje(e.target.value as MotivoViaje)}
                >
                  {MOTIVOS_VIAJE.map((m) => <option key={m}>{m}</option>)}
                </Selector>
              </Campo>
            </div>
          </Panel>

          {/* 5. Estancia */}
          <Panel titulo="5. Estancia">
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <Campo etiqueta="Fecha y hora de ingreso" requerido error={errores.fecha_ingreso}>
                <Entrada
                  type="datetime-local"
                  required
                  value={ingreso}
                  onChange={(e) => setIngreso(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Salida estimada" requerido error={errores.fecha_salida_estimada}>
                <Entrada
                  type="datetime-local"
                  required
                  value={salida}
                  onChange={(e) => setSalida(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Precio por persona / noche (COP)" requerido error={errores.valor_noche}>
                <Entrada
                  type="number"
                  min={0}
                  step={1000}
                  required
                  className="num"
                  value={valorNoche || ''}
                  onChange={(e) => setValorNoche(Number(e.target.value))}
                />
              </Campo>
              <Campo etiqueta="Método de pago" requerido>
                <Selector value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                  {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
                </Selector>
              </Campo>
              <Campo etiqueta="Anticipo recibido (COP)" ayuda="Deje en cero si no hay abono.">
                <Entrada
                  type="number"
                  min={0}
                  step={1000}
                  className="num"
                  value={anticipo || ''}
                  onChange={(e) => setAnticipo(Number(e.target.value))}
                />
              </Campo>
              <Campo etiqueta="Observaciones" className="sm:col-span-2">
                <AreaTexto
                  rows={2}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Solicita cuna adicional, llega en vehículo, factura a nombre de…"
                />
              </Campo>
            </div>
          </Panel>
        </div>

        {/* Resumen fijo */}
        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Panel titulo="Resumen">
            <dl className="divide-y divide-border text-sm">
              {[
                ['Huésped principal', huesped?.nombre_completo ?? '—'],
                ['Habitación', habitacion ? `${habitacion.numero} · ${habitacion.tipo}` : '—'],
                ['Capacidad', habitacion ? `${ocupacionActual} / ${capacidadMax}` : '—'],
                ['Noches estimadas', String(noches)],
                ['Precio persona / noche', moneda(valorNoche)],
                ['Anticipo', moneda(anticipo)],
              ].map(([clave, valor]) => (
                <div key={clave} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                  <dt className="text-muted-foreground">{clave}</dt>
                  <dd className="num text-right">{valor}</dd>
                </div>
              ))}

              {/* Ocupación */}
              <div className="px-5 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Adultos: {1 + acompanantes.filter((a) => a.tipo === 'adulto').length} ·
                  Niños: {acompanantes.filter((a) => a.tipo === 'nino').length}
                </p>
              </div>

              {/* Acompañantes desplegable */}
              {acompanantes.length > 0 ? (
                <div className="px-5 py-2.5">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setAcompanantesExpandidos((v) => !v)}
                  >
                    <span>Ver acompañantes ({acompanantes.length})</span>
                    <Icono
                      nombre={acompanantesExpandidos ? 'salida' : 'entrada'}
                      className="size-3.5"
                    />
                  </button>
                  {acompanantesExpandidos ? (
                    <ul className="mt-2 space-y-1">
                      {acompanantes.map((a) => (
                        <li key={a.huesped.id} className="text-xs">
                          <span className="font-medium">{a.huesped.nombre_completo}</span>
                          <span className="text-muted-foreground"> · {a.tipo === 'adulto' ? 'Adulto' : 'Niño/a'}</span>
                          {a.relacion ? (
                            <span className="text-muted-foreground"> · {a.relacion === 'Otro' && a.relacion_otro ? a.relacion_otro : a.relacion}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* Fórmula de cobro */}
              <div className="px-5 py-2.5">
                <p className="text-[10px] text-muted-foreground font-mono">
                  {totalPersonas > 0 ? totalPersonas : 1} persona{totalPersonas !== 1 ? 's' : ''} × {noches} noche{noches !== 1 ? 's' : ''} × {moneda(valorNoche)}
                </p>
              </div>

              <div className="flex items-baseline justify-between gap-3 bg-secondary/50 px-5 py-4">
                <dt className="font-mono text-[10px] tracking-[0.14em] uppercase">Total estimado</dt>
                <dd className="num text-xl text-primary">{moneda(estimado)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                <dt className="text-sm text-muted-foreground">Saldo pendiente</dt>
                <dd className="num text-sm text-foreground">{moneda(Math.max(0, estimado - anticipo))}</dd>
              </div>
            </dl>
            <div className="space-y-2 p-5">
              <Boton type="submit" className="w-full" disabled={ocupado || !huesped || !habitacionId}>
                {ocupado ? 'Registrando…' : 'Registrar check-in'}
              </Boton>
              <Boton type="button" variante="contorno" className="w-full" onClick={limpiar}>
                Limpiar formulario
              </Boton>
              <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                Al guardar, la habitación cambia a <strong>Ocupada</strong>, el anticipo queda en
                pagos y se crea automáticamente un registro TRA por cada persona del grupo.
              </p>
            </div>
          </Panel>
        </aside>
      </form>

      {/* Modal: registrar huésped principal nuevo */}
      <Modal
        abierto={nuevoAbierto}
        titulo="Registrar huésped"
        descripcion="Quedará guardado para próximas estancias."
        ancho="max-w-3xl"
        alCerrar={() => setNuevoAbierto(false)}
      >
        <form onSubmit={registrarNuevoPrincipal} className="space-y-4 p-5">
          {erroresNuevo.general ? <Aviso>{erroresNuevo.general}</Aviso> : null}
          <FormularioHuesped valor={nuevo} alCambiar={setNuevo} errores={erroresNuevo} />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Boton type="button" variante="contorno" onClick={() => setNuevoAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit">Registrar y seleccionar</Boton>
          </div>
        </form>
      </Modal>

      {/* Modal: agregar acompañante */}
      {modalAcompAbierto ? (
        <ModalAgregarAcompanante
          huespedes={huespedes}
          excluidos={excluidos}
          onAgregar={agregarAcompanante}
          onCerrar={() => setModalAcompAbierto(false)}
        />
      ) : null}
    </div>
  )
}
