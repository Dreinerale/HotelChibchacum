/** Gestión de habitaciones: crear, editar, eliminar, buscar y filtrar. */

import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import {
  AreaTexto,
  Aviso,
  Boton,
  Buscador,
  Campo,
  Entrada,
  EstadoHab,
  Fila,
  Modal,
  Panel,
  Selector,
  Tabla,
  Td,
  Th,
  Vacio,
} from '../components/ui'
import { repositorio } from '../data'
import { ErrorAplicacion } from '../data/repositorio'
import {
  CAPACIDAD_DEFAULT,
  ESTADOS_HABITACION,
  TIPOS_HABITACION,
  type EstadoHabitacion,
  type Habitacion,
  type TipoHabitacion,
} from '../domain/types'
import { moneda, normalizar } from '../domain/utils'

const vacia = {
  numero: '',
  tipo: 'Sencilla' as TipoHabitacion,
  capacidad: CAPACIDAD_DEFAULT['Sencilla'],
  precio_noche: 0,
  estado: 'Disponible' as EstadoHabitacion,
  observaciones: '',
}

export default function Habitaciones() {
  const { habitaciones, activas, refrescar, esAdmin } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'Todos' | EstadoHabitacion>('Todos')
  const [editando, setEditando] = useState<Habitacion | null>(null)
  const [creando, setCreando] = useState(false)
  const [borrando, setBorrando] = useState<Habitacion | null>(null)
  const [formulario, setFormulario] = useState(vacia)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda)
    return habitaciones.filter((h) => {
      const coincide =
        !q ||
        normalizar(h.numero).includes(q) ||
        normalizar(h.tipo).includes(q) ||
        normalizar(h.observaciones).includes(q)
      return coincide && (filtro === 'Todos' || h.estado === filtro)
    })
  }, [habitaciones, busqueda, filtro])

  const abrirCreacion = () => {
    setFormulario(vacia)
    setErrores({})
    setMensaje('')
    setCreando(true)
  }

  const abrirEdicion = (habitacion: Habitacion) => {
    setFormulario({ ...habitacion })
    setErrores({})
    setMensaje('')
    setEditando(habitacion)
  }

  const cerrar = () => {
    setCreando(false)
    setEditando(null)
    setErrores({})
  }

  const guardar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setOcupado(true)
    setErrores({})
    try {
      if (editando) {
        await repositorio.actualizarHabitacion(editando.id, formulario)
        setMensaje(`Habitación ${formulario.numero} actualizada.`)
      } else {
        await repositorio.crearHabitacion(formulario)
        setMensaje(`Habitación ${formulario.numero} creada.`)
      }
      await refrescar()
      cerrar()
    } catch (e) {
      if (e instanceof ErrorAplicacion) {
        setErrores(e.campos)
        if (Object.keys(e.campos).length === 0) setErrores({ general: e.message })
      } else {
        setErrores({ general: 'Ocurrió un error inesperado.' })
      }
    } finally {
      setOcupado(false)
    }
  }

  const eliminar = async () => {
    if (!borrando) return
    setOcupado(true)
    try {
      await repositorio.eliminarHabitacion(borrando.id)
      await refrescar()
      setMensaje(`Habitación ${borrando.numero} eliminada.`)
      setBorrando(null)
    } catch (e) {
      setMensaje(e instanceof ErrorAplicacion ? e.message : 'No se pudo eliminar.')
      setBorrando(null)
    } finally {
      setOcupado(false)
    }
  }

  const conteo = (estado: EstadoHabitacion) => habitaciones.filter((h) => h.estado === estado).length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl leading-tight">Habitaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {habitaciones.length} registradas · {conteo('Disponible')} disponibles ·{' '}
            {conteo('Ocupada')} ocupadas
          </p>
        </div>
        <Boton icono="mas" onClick={abrirCreacion}>
          Nueva habitación
        </Boton>
      </header>

      {mensaje ? <Aviso tipo="ok">{mensaje}</Aviso> : null}

      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <Buscador
            valor={busqueda}
            alCambiar={setBusqueda}
            marcador="Buscar por número, tipo u observación…"
          />
          <div className="flex flex-wrap gap-1.5">
            {(['Todos', ...ESTADOS_HABITACION] as const).map((estado) => (
              <button
                key={estado}
                onClick={() => setFiltro(estado)}
                className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors ${
                  filtro === estado
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {estado}
              </button>
            ))}
          </div>
        </div>

        {filtradas.length === 0 ? (
          <Vacio
            titulo={habitaciones.length === 0 ? 'Aún no hay habitaciones' : 'Sin coincidencias'}
            mensaje={
              habitaciones.length === 0
                ? 'Registre el inventario del hotel para poder hacer check-in.'
                : 'Ajuste la búsqueda o el filtro de estado.'
            }
            accion={
              habitaciones.length === 0 ? (
                <Boton icono="mas" onClick={abrirCreacion}>
                  Crear la primera
                </Boton>
              ) : undefined
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Número</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Capacidad</Th>
                <Th className="text-right">Precio / persona · noche</Th>
                <Th>Estado</Th>
                <Th>Huésped actual</Th>
                <Th>Observaciones</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((habitacion) => {
                const estancia = activas.find((e) => e.habitacion_id === habitacion.id)
                return (
                  <Fila key={habitacion.id}>
                    <Td className="num text-base">{habitacion.numero}</Td>
                    <Td>{habitacion.tipo}</Td>
                    <Td className="num text-right text-sm text-muted-foreground">
                      hasta {habitacion.capacidad}
                    </Td>
                    <Td className="num text-right">{moneda(habitacion.precio_noche)}</Td>
                    <Td>
                      <EstadoHab estado={habitacion.estado} />
                    </Td>
                    <Td className="text-sm">
                      {estancia?.huesped?.nombre_completo ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="max-w-[16rem] truncate text-xs text-muted-foreground">
                      {habitacion.observaciones || '—'}
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        <Boton
                          variante="fantasma"
                          icono="lapiz"
                          aria-label={`Editar habitación ${habitacion.numero}`}
                          onClick={() => abrirEdicion(habitacion)}
                        />
                        {esAdmin ? (
                          <Boton
                            variante="fantasma"
                            icono="basura"
                            aria-label={`Eliminar habitación ${habitacion.numero}`}
                            onClick={() => setBorrando(habitacion)}
                          />
                        ) : null}
                      </div>
                    </Td>
                  </Fila>
                )
              })}
            </tbody>
          </Tabla>
        )}
      </Panel>

      <Modal
        abierto={creando || editando !== null}
        titulo={editando ? `Editar habitación ${editando.numero}` : 'Nueva habitación'}
        descripcion="El estado cambia automáticamente durante el check-in y el check-out."
        ancho="max-w-xl"
        alCerrar={cerrar}
      >
        <form onSubmit={guardar} className="space-y-4 p-5">
          {errores.general ? <Aviso>{errores.general}</Aviso> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Número" requerido error={errores.numero}>
              <Entrada
                required
                value={formulario.numero}
                onChange={(e) => setFormulario({ ...formulario, numero: e.target.value })}
                placeholder="101"
              />
            </Campo>
            <Campo etiqueta="Tipo" requerido>
              <Selector
                value={formulario.tipo}
                onChange={(e) => {
                  const tipo = e.target.value as TipoHabitacion
                  setFormulario((f) => ({
                    ...f,
                    tipo,
                    // Sugerir capacidad por defecto al cambiar tipo, pero solo si el usuario no la modificó
                    capacidad: CAPACIDAD_DEFAULT[tipo],
                  }))
                }}
              >
                {TIPOS_HABITACION.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Selector>
            </Campo>
            <Campo
              etiqueta="Capacidad máxima (personas)"
              requerido
              error={errores.capacidad}
              ayuda="Incluye huésped principal y acompañantes"
            >
              <Entrada
                type="number"
                min={1}
                step={1}
                required
                className="num"
                value={formulario.capacidad || ''}
                onChange={(e) =>
                  setFormulario({ ...formulario, capacidad: Math.max(1, Math.floor(Number(e.target.value))) })
                }
              />
            </Campo>
            <Campo etiqueta="Precio por persona / noche (COP)" requerido error={errores.precio_noche}>
              <Entrada
                type="number"
                min={0}
                step={1000}
                required
                value={formulario.precio_noche || ''}
                onChange={(e) =>
                  setFormulario({ ...formulario, precio_noche: Number(e.target.value) })
                }
                className="num"
                placeholder="120000"
              />
            </Campo>
            <Campo etiqueta="Estado" requerido error={errores.estado}>
              <Selector
                value={formulario.estado}
                onChange={(e) =>
                  setFormulario({ ...formulario, estado: e.target.value as EstadoHabitacion })
                }
              >
                {ESTADOS_HABITACION.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Selector>
            </Campo>
          </div>
          <Campo etiqueta="Observaciones">
            <AreaTexto
              rows={3}
              value={formulario.observaciones}
              onChange={(e) => setFormulario({ ...formulario, observaciones: e.target.value })}
              placeholder="Vista al parque, aire acondicionado, cama extra disponible…"
            />
          </Campo>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Boton type="button" variante="contorno" onClick={cerrar}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear habitación'}
            </Boton>
          </div>
        </form>
      </Modal>

      <Modal
        abierto={borrando !== null}
        titulo="Eliminar habitación"
        ancho="max-w-md"
        alCerrar={() => setBorrando(null)}
      >
        <div className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            ¿Confirma eliminar la habitación{' '}
            <span className="num text-foreground">{borrando?.numero}</span>? Esta acción no se puede
            deshacer y solo es posible si no tiene estancias registradas.
          </p>
          <div className="flex justify-end gap-2">
            <Boton variante="contorno" onClick={() => setBorrando(null)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" disabled={ocupado} onClick={() => void eliminar()}>
              Eliminar
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
