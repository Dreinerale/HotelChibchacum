/**
 * Registro TRA — pantalla de revisión y gestión.
 * Los registros se crean automáticamente en el check-in.
 * Aquí se completan campos faltantes, se consulta el estado y se anula si aplica.
 */

import { useState, useMemo } from 'react'
import { useApp } from '../app/store'
import Icono from '../components/Icono'
import {
  AreaTexto,
  Aviso,
  Boton,
  Buscador,
  Campo,
  Entrada,
  Fila,
  Insignia,
  Modal,
  Panel,
  Selector,
  Tabla,
  Td,
  Th,
  Vacio,
} from '../components/ui'
import { repositorio } from '../data'
import { ErrorAplicacion, type NuevoRegistroAlojamiento } from '../data/repositorio'
import {
  ESTADOS_REGISTRO,
  MOTIVOS_VIAJE,
  type EstadoRegistro,
  type MotivoViaje,
  type RegistroAlojamiento,
} from '../domain/types'
import { formatoFecha, normalizar } from '../domain/utils'

const etiquetaEstado: Record<EstadoRegistro, string> = {
  borrador: 'Incompleto',
  activo: 'Activo',
  checkout_realizado: 'Check-out realizado',
  anulado: 'Anulado',
}

const tonoEstado: Record<EstadoRegistro, 'activo' | 'neutro' | 'alerta' | 'peligro'> = {
  borrador: 'alerta',
  activo: 'activo',
  checkout_realizado: 'neutro',
  anulado: 'peligro',
}

interface FormCompletar {
  ciudad_procedencia: string
  motivo_viaje: MotivoViaje
}

export default function RegistroTRA({ alNavegar }: { alNavegar?: (clave: string) => void }) {
  const { registrosDetallados, refrescar, esAdmin } = useApp()

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoRegistro | 'todos'>('todos')
  const [mensaje, setMensaje] = useState('')

  // Modal completar campos faltantes
  const [completandoId, setCompletandoId] = useState<number | null>(null)
  const [formCompletar, setFormCompletar] = useState<FormCompletar>({ ciudad_procedencia: '', motivo_viaje: 'Turismo' })
  const [errorCompletar, setErrorCompletar] = useState('')
  const [ocupadoCompletar, setOcupado] = useState(false)

  // Modal ver detalle
  const [detalleId, setDetalleId] = useState<number | null>(null)

  // Modal anulación
  const [anulandoId, setAnulandoId] = useState<number | null>(null)
  const [motivoAnulacion, setMotivoAnulacion] = useState('')

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    return registrosDetallados.filter((r) => {
      if (filtroEstado !== 'todos' && r.estado_registro !== filtroEstado) return false
      if (!q) return true
      return [
        r.huesped?.nombre_completo ?? '',
        r.huesped?.numero_identificacion ?? '',
        r.habitacion?.numero ?? '',
        r.ciudad_procedencia,
        r.motivo_viaje,
      ].map(normalizar).some((c) => c.includes(q))
    })
  }, [registrosDetallados, busqueda, filtroEstado])

  const soloActivos = registrosDetallados.filter((r) => r.estado_registro === 'activo').length
  const borradores = registrosDetallados.filter((r) => r.estado_registro === 'borrador').length

  const abrirCompletar = (reg: RegistroAlojamiento) => {
    setCompletandoId(reg.id)
    setFormCompletar({
      ciudad_procedencia: reg.ciudad_procedencia,
      motivo_viaje: reg.motivo_viaje,
    })
    setErrorCompletar('')
  }

  const guardarCompletar = async () => {
    if (!completandoId) return
    if (!formCompletar.ciudad_procedencia.trim()) {
      setErrorCompletar('Ingrese la ciudad de procedencia.')
      return
    }
    setOcupado(true)
    try {
      const update: Partial<NuevoRegistroAlojamiento> = {
        ciudad_procedencia: formCompletar.ciudad_procedencia.trim(),
        motivo_viaje: formCompletar.motivo_viaje,
        estado_registro: 'activo',
      }
      await repositorio.actualizarRegistroAlojamiento(completandoId, update)
      await refrescar()
      setMensaje('Registro TRA completado y activado.')
      setCompletandoId(null)
    } catch (e) {
      setErrorCompletar(e instanceof ErrorAplicacion ? e.message : 'Error inesperado.')
    } finally {
      setOcupado(false)
    }
  }

  const anular = async () => {
    if (!anulandoId) return
    try {
      await repositorio.anularRegistroAlojamiento(anulandoId, motivoAnulacion)
      await refrescar()
      setMensaje('Registro anulado. La trazabilidad queda conservada en el historial.')
    } catch (e) {
      setMensaje(e instanceof ErrorAplicacion ? e.message : 'No se pudo anular.')
    } finally {
      setAnulandoId(null)
      setMotivoAnulacion('')
    }
  }

  const acompanantesDeGrupo = (grupoId: string) =>
    registrosDetallados.filter((r) => r.grupo_id === grupoId && !r.es_huesped_principal)

  const regDetalle = registrosDetallados.find((r) => r.id === detalleId)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl leading-tight">Registro TRA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {soloActivos} activos · {borradores > 0 ? `${borradores} incompletos · ` : ''}{registrosDetallados.length} en total
          </p>
        </div>
        {alNavegar ? (
          <Boton variante="contorno" onClick={() => alNavegar('reportes')}>
            Exportar CSV → Reportes
          </Boton>
        ) : null}
      </header>

      {/* Aviso institucional */}
      <div className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50/80 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-900/20">
        <Icono nombre="info" className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <strong>Flujo TRA:</strong> Los registros se crean automáticamente al hacer check-in. Si el
          registro aparece como <em>Incompleto</em>, use el botón «Completar» para agregar los datos
          faltantes. El establecimiento debe verificar y realizar el reporte oficial según los canales y
          plazos vigentes de MinCIT/iNNpulsa.
        </p>
      </div>

      {borradores > 0 ? (
        <Aviso>
          {borradores} registro(s) incompleto(s) — falta la ciudad de procedencia. Búsquelos con el
          filtro «Incompleto» y complételos antes del reporte oficial.
        </Aviso>
      ) : null}

      {mensaje ? <Aviso tipo="ok">{mensaje}</Aviso> : null}

      <Panel>
        <div className="flex flex-wrap gap-3 border-b border-border px-5 py-4">
          <div className="min-w-[200px] flex-1">
            <Buscador
              valor={busqueda}
              alCambiar={setBusqueda}
              marcador="Buscar por huésped, documento, habitación o procedencia…"
            />
          </div>
          <Selector
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoRegistro | 'todos')}
            className="w-auto min-w-[160px]"
          >
            <option value="todos">Todos los estados</option>
            <option value="borrador">Incompletos</option>
            {ESTADOS_REGISTRO.filter((s) => s.valor !== 'borrador').map((s) => (
              <option key={s.valor} value={s.valor}>{s.etiqueta}</option>
            ))}
          </Selector>
        </div>

        {filtrados.length === 0 ? (
          <Vacio
            titulo={registrosDetallados.length === 0 ? 'Sin registros TRA' : 'Sin coincidencias'}
            mensaje={
              registrosDetallados.length === 0
                ? 'Los registros TRA se crean automáticamente al realizar check-in.'
                : 'Pruebe con otros filtros.'
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Huésped</Th>
                <Th>Habitación</Th>
                <Th>Procedencia</Th>
                <Th>Motivo</Th>
                <Th>Check-in</Th>
                <Th>Check-out</Th>
                <Th>Estado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((reg) => {
                const acomps = acompanantesDeGrupo(reg.grupo_id)
                const incompleto = reg.estado_registro === 'borrador'
                return (
                  <Fila key={reg.id}>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {reg.huesped?.nombre_completo ?? `Huésped #${reg.huesped_id}`}
                        </span>
                        {reg.es_huesped_principal ? (
                          <Insignia tono="activo">Principal</Insignia>
                        ) : (
                          <Insignia tono="neutro">Acompañante</Insignia>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {reg.huesped?.tipo_identificacion} {reg.huesped?.numero_identificacion}
                        {acomps.length > 0 ? ` · ${acomps.length} acomp.` : ''}
                      </p>
                    </Td>
                    <Td className="num text-sm">
                      {reg.habitacion?.numero ?? `#${reg.habitacion_id}`}
                      <p className="text-xs text-muted-foreground">{reg.habitacion?.tipo}</p>
                    </Td>
                    <Td className="text-xs">
                      {incompleto ? (
                        <span className="text-amber-700 dark:text-amber-400">— pendiente —</span>
                      ) : (
                        reg.ciudad_procedencia
                      )}
                    </Td>
                    <Td className="text-xs">{reg.motivo_viaje}</Td>
                    <Td className="num whitespace-nowrap text-xs">{formatoFecha(reg.check_in_at)}</Td>
                    <Td className="num whitespace-nowrap text-xs">
                      {reg.check_out_at ? formatoFecha(reg.check_out_at) : '—'}
                    </Td>
                    <Td>
                      <Insignia tono={tonoEstado[reg.estado_registro]}>
                        {etiquetaEstado[reg.estado_registro]}
                      </Insignia>
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      <div className="inline-flex gap-1">
                        <Boton
                          variante="fantasma"
                          icono="info"
                          aria-label="Ver detalle"
                          onClick={() => setDetalleId(reg.id)}
                        />
                        {incompleto && (
                          <Boton
                            variante="fantasma"
                            icono="lapiz"
                            aria-label="Completar datos TRA"
                            onClick={() => abrirCompletar(reg)}
                          />
                        )}
                        {esAdmin && reg.estado_registro !== 'anulado' && (
                          <Boton
                            variante="fantasma"
                            icono="basura"
                            aria-label="Anular registro"
                            onClick={() => { setAnulandoId(reg.id); setMotivoAnulacion('') }}
                          />
                        )}
                      </div>
                    </Td>
                  </Fila>
                )
              })}
            </tbody>
          </Tabla>
        )}
      </Panel>

      {/* Modal: completar datos faltantes */}
      <Modal
        abierto={completandoId !== null}
        titulo="Completar datos TRA"
        descripcion="Ingrese los datos de la estadía requeridos por el reporte oficial."
        ancho="max-w-md"
        alCerrar={() => setCompletandoId(null)}
      >
        <div className="space-y-4 p-5">
          {errorCompletar ? <Aviso>{errorCompletar}</Aviso> : null}
          <Campo etiqueta="Ciudad de procedencia" requerido ayuda="Ciudad desde la que viajó el huésped antes de llegar">
            <Entrada
              autoFocus
              value={formCompletar.ciudad_procedencia}
              onChange={(e) => setFormCompletar((f) => ({ ...f, ciudad_procedencia: e.target.value }))}
              placeholder="Bogotá, Medellín, Nueva York…"
            />
          </Campo>
          <Campo etiqueta="Motivo del viaje" requerido>
            <Selector
              value={formCompletar.motivo_viaje}
              onChange={(e) => setFormCompletar((f) => ({ ...f, motivo_viaje: e.target.value as MotivoViaje }))}
            >
              {MOTIVOS_VIAJE.map((m) => <option key={m}>{m}</option>)}
            </Selector>
          </Campo>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Boton variante="contorno" onClick={() => setCompletandoId(null)}>
              Cancelar
            </Boton>
            <Boton disabled={ocupadoCompletar} onClick={() => void guardarCompletar()}>
              {ocupadoCompletar ? 'Guardando…' : 'Guardar y activar'}
            </Boton>
          </div>
        </div>
      </Modal>

      {/* Modal: detalle del registro */}
      <Modal
        abierto={detalleId !== null}
        titulo="Detalle del registro TRA"
        ancho="max-w-md"
        alCerrar={() => setDetalleId(null)}
      >
        {regDetalle ? (
          <dl className="divide-y divide-border text-sm">
            {[
              ['Huésped', regDetalle.huesped?.nombre_completo ?? `#${regDetalle.huesped_id}`],
              ['Tipo ID', regDetalle.huesped?.tipo_identificacion ?? '—'],
              ['Número ID', regDetalle.huesped?.numero_identificacion ?? '—'],
              ['Ciudad residencia', regDetalle.huesped?.ciudad_residencia || '—'],
              ['Ciudad procedencia', regDetalle.ciudad_procedencia || '— (pendiente)'],
              ['Motivo del viaje', regDetalle.motivo_viaje],
              ['Habitación', regDetalle.habitacion?.numero ?? `#${regDetalle.habitacion_id}`],
              ['Check-in', formatoFecha(regDetalle.check_in_at)],
              ['Check-out', regDetalle.check_out_at ? formatoFecha(regDetalle.check_out_at) : '—'],
              ['Rol en grupo', regDetalle.es_huesped_principal ? 'Huésped principal' : 'Acompañante'],
              ['Estado', etiquetaEstado[regDetalle.estado_registro]],
              ...(regDetalle.motivo_anulacion ? [['Motivo anulación', regDetalle.motivo_anulacion]] : []),
            ].map(([clave, valor]) => (
              <div key={clave} className="flex items-start justify-between gap-4 px-5 py-2.5">
                <dt className="shrink-0 text-muted-foreground">{clave}</dt>
                <dd className="text-right">{valor}</dd>
              </div>
            ))}
            <div className="px-5 py-3">
              <Boton className="w-full" variante="contorno" onClick={() => setDetalleId(null)}>
                Cerrar
              </Boton>
            </div>
          </dl>
        ) : null}
      </Modal>

      {/* Modal anulación */}
      <Modal
        abierto={anulandoId !== null}
        titulo="Anular registro TRA"
        ancho="max-w-md"
        alCerrar={() => { setAnulandoId(null); setMotivoAnulacion('') }}
      >
        <div className="space-y-4 p-5">
          <Aviso>
            El registro no se eliminará. Quedará marcado como anulado con trazabilidad completa.
          </Aviso>
          <Campo etiqueta="Motivo de anulación" requerido>
            <AreaTexto
              rows={3}
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
              placeholder="Ingrese el motivo de la anulación…"
            />
          </Campo>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Boton variante="contorno" onClick={() => { setAnulandoId(null); setMotivoAnulacion('') }}>
              Cancelar
            </Boton>
            <Boton variante="peligro" disabled={!motivoAnulacion.trim()} onClick={() => void anular()}>
              Anular registro
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
