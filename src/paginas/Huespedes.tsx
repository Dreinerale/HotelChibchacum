/**
 * Registro de huéspedes con campos TRA Colombia.
 */

import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import {
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
import { repositorio, type NuevoHuesped } from '../data'
import { ErrorAplicacion } from '../data/repositorio'
import { TIPOS_IDENTIFICACION, type Huesped, type TipoIdentificacion } from '../domain/types'
import { edad, formatoFecha, normalizar } from '../domain/utils'

export const huespedVacio: NuevoHuesped = {
  primer_nombre: '',
  segundo_nombre: '',
  primer_apellido: '',
  segundo_apellido: '',
  tipo_identificacion: 'Cédula de ciudadanía',
  numero_identificacion: '',
  nacionalidad: 'Colombiana',
  fecha_nacimiento: '',
  pais_residencia: 'Colombia',
  departamento_residencia: '',
  ciudad_residencia: '',
  telefono: '',
  email: '',
  direccion: '',
  nombre_completo: '',
  tipo_documento: 'Cédula de ciudadanía',
  numero_documento: '',
  ciudad: '',
  correo: '',
  profesion: '',
  placa_vehiculo: '',
}

/** Formulario reutilizable — se usa también dentro del check-in y TRA. */
export function FormularioHuesped({
  valor,
  alCambiar,
  errores,
  compacto = false,
}: {
  valor: NuevoHuesped
  alCambiar: (v: NuevoHuesped) => void
  errores: Record<string, string>
  compacto?: boolean
}) {
  const set = (parcial: Partial<NuevoHuesped>) => alCambiar({ ...valor, ...parcial })

  return (
    <div className="space-y-5">
      {/* Sección: Nombre */}
      <div>
        <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Nombre completo
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Primer nombre" requerido error={errores.primer_nombre}>
            <Entrada
              required
              value={valor.primer_nombre}
              onChange={(e) => set({ primer_nombre: e.target.value })}
              placeholder="María Fernanda"
            />
          </Campo>
          <Campo etiqueta="Segundo nombre" ayuda="Opcional">
            <Entrada
              value={valor.segundo_nombre}
              onChange={(e) => set({ segundo_nombre: e.target.value })}
              placeholder="Paola"
            />
          </Campo>
          <Campo etiqueta="Primer apellido" requerido error={errores.primer_apellido}>
            <Entrada
              required
              value={valor.primer_apellido}
              onChange={(e) => set({ primer_apellido: e.target.value })}
              placeholder="Rojas"
            />
          </Campo>
          <Campo etiqueta="Segundo apellido" ayuda="Opcional">
            <Entrada
              value={valor.segundo_apellido}
              onChange={(e) => set({ segundo_apellido: e.target.value })}
              placeholder="Peña"
            />
          </Campo>
        </div>
      </div>

      {/* Sección: Identificación */}
      <div>
        <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          Identificación
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tipo de identificación" requerido>
            <Selector
              value={valor.tipo_identificacion}
              onChange={(e) => set({ tipo_identificacion: e.target.value as TipoIdentificacion })}
            >
              {TIPOS_IDENTIFICACION.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Número de identificación" requerido error={errores.numero_identificacion}>
            <Entrada
              required
              className="num"
              value={valor.numero_identificacion}
              onChange={(e) => set({ numero_identificacion: e.target.value })}
              placeholder="52987654"
            />
          </Campo>
          <Campo etiqueta="Nacionalidad" requerido>
            <Entrada
              required
              value={valor.nacionalidad}
              onChange={(e) => set({ nacionalidad: e.target.value })}
              placeholder="Colombiana"
            />
          </Campo>
          <Campo etiqueta="Fecha de nacimiento" ayuda="Opcional">
            <Entrada
              type="date"
              value={valor.fecha_nacimiento}
              onChange={(e) => set({ fecha_nacimiento: e.target.value })}
            />
          </Campo>
        </div>
      </div>

      {/* Sección: Residencia (TRA) */}
      <div>
        <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          País y ciudad de residencia (TRA)
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="País de residencia" requerido>
            <Entrada
              required
              value={valor.pais_residencia}
              onChange={(e) => set({ pais_residencia: e.target.value })}
              placeholder="Colombia"
            />
          </Campo>
          <Campo etiqueta="Departamento / Estado">
            <Entrada
              value={valor.departamento_residencia}
              onChange={(e) => set({ departamento_residencia: e.target.value })}
              placeholder="Cundinamarca"
            />
          </Campo>
          <Campo etiqueta="Ciudad de residencia" requerido>
            <Entrada
              required
              value={valor.ciudad_residencia}
              onChange={(e) => set({ ciudad_residencia: e.target.value, ciudad: e.target.value })}
              placeholder="Bogotá"
            />
          </Campo>
        </div>
      </div>

      {/* Sección: Contacto interno */}
      {!compacto && (
        <div>
          <p className="mb-3 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Contacto interno (opcional)
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Teléfono" requerido error={errores.telefono}>
              <Entrada
                required
                className="num"
                value={valor.telefono}
                onChange={(e) => set({ telefono: e.target.value })}
                placeholder="300 123 4567"
              />
            </Campo>
            <Campo etiqueta="Correo electrónico" error={errores.email}>
              <Entrada
                type="email"
                value={valor.email}
                onChange={(e) => set({ email: e.target.value, correo: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </Campo>
            <Campo etiqueta="Dirección">
              <Entrada
                value={valor.direccion}
                onChange={(e) => set({ direccion: e.target.value })}
                placeholder="Calle 20 # 9-45"
              />
            </Campo>
            <Campo etiqueta="Profesión">
              <Entrada
                value={valor.profesion}
                onChange={(e) => set({ profesion: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Placa del vehículo" ayuda="Opcional">
              <Entrada
                className="num uppercase"
                value={valor.placa_vehiculo}
                onChange={(e) => set({ placa_vehiculo: e.target.value })}
                placeholder="ABC123"
              />
            </Campo>
          </div>
        </div>
      )}

      {compacto && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Teléfono" requerido error={errores.telefono}>
            <Entrada
              required
              className="num"
              value={valor.telefono}
              onChange={(e) => set({ telefono: e.target.value })}
              placeholder="300 123 4567"
            />
          </Campo>
          <Campo etiqueta="Correo electrónico" error={errores.email}>
            <Entrada
              type="email"
              value={valor.email}
              onChange={(e) => set({ email: e.target.value, correo: e.target.value })}
              placeholder="correo@ejemplo.com"
            />
          </Campo>
        </div>
      )}
    </div>
  )
}

export default function Huespedes() {
  const { huespedes, activas, detalladas, refrescar, esAdmin } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [formulario, setFormulario] = useState<NuevoHuesped>(huespedVacio)
  const [editando, setEditando] = useState<Huesped | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [borrando, setBorrando] = useState<Huesped | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return huespedes
    return huespedes.filter((h) =>
      [
        h.nombre_completo,
        h.primer_nombre,
        h.primer_apellido,
        h.numero_identificacion,
        h.telefono,
        h.email,
        h.ciudad_residencia,
        h.placa_vehiculo,
      ]
        .map(normalizar)
        .some((campo) => campo.includes(q)),
    )
  }, [huespedes, busqueda])

  const abrir = (huesped?: Huesped) => {
    setEditando(huesped ?? null)
    setFormulario(huesped ? { ...huesped } : huespedVacio)
    setErrores({})
    setMensaje('')
    setAbierto(true)
  }

  const guardar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setOcupado(true)
    setErrores({})
    try {
      const nombreCompleto = [
        formulario.primer_nombre,
        formulario.segundo_nombre,
        formulario.primer_apellido,
        formulario.segundo_apellido,
      ].filter(Boolean).join(' ')
      const datos = { ...formulario, nombre_completo: nombreCompleto }
      if (editando) await repositorio.actualizarHuesped(editando.id, datos)
      else await repositorio.crearHuesped(datos)
      await refrescar()
      setMensaje(`Huésped ${nombreCompleto} ${editando ? 'actualizado' : 'registrado'}.`)
      setAbierto(false)
    } catch (e) {
      if (e instanceof ErrorAplicacion) {
        setErrores(Object.keys(e.campos).length ? e.campos : { general: e.message })
      } else setErrores({ general: 'Ocurrió un error inesperado.' })
    } finally {
      setOcupado(false)
    }
  }

  const eliminar = async () => {
    if (!borrando) return
    try {
      await repositorio.eliminarHuesped(borrando.id)
      await refrescar()
      setMensaje('Huésped eliminado.')
    } catch (e) {
      setMensaje(e instanceof ErrorAplicacion ? e.message : 'No se pudo eliminar.')
    } finally {
      setBorrando(null)
    }
  }

  const visitas = (id: number) => detalladas.filter((e) => e.huesped_id === id).length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl leading-tight">Huéspedes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {huespedes.length} personas en la base de datos del hotel
          </p>
        </div>
        <Boton icono="mas" onClick={() => abrir()}>
          Registrar huésped
        </Boton>
      </header>

      {mensaje ? <Aviso tipo="ok">{mensaje}</Aviso> : null}

      <Panel>
        <div className="border-b border-border px-5 py-4">
          <Buscador
            valor={busqueda}
            alCambiar={setBusqueda}
            marcador="Buscar por nombre, documento, teléfono o placa…"
          />
        </div>
        {filtrados.length === 0 ? (
          <Vacio
            titulo={huespedes.length === 0 ? 'Sin huéspedes registrados' : 'Sin coincidencias'}
            mensaje={
              huespedes.length === 0
                ? 'Registre al primer huésped para poder hacer check-in.'
                : 'Pruebe con otro nombre o número de documento.'
            }
            accion={
              huespedes.length === 0 ? (
                <Boton icono="mas" onClick={() => abrir()}>
                  Registrar huésped
                </Boton>
              ) : undefined
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Huésped</Th>
                <Th>Identificación</Th>
                <Th>Contacto</Th>
                <Th>Residencia</Th>
                <Th>Nacimiento</Th>
                <Th className="text-right">Visitas</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((huesped) => {
                const hospedado = activas.some((e) => e.huesped_id === huesped.id)
                const anios = edad(huesped.fecha_nacimiento)
                const esDemostracion = huesped.primer_nombre?.startsWith('DEMO')
                return (
                  <Fila key={huesped.id}>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{huesped.nombre_completo}</span>
                        {hospedado ? <Insignia tono="activo">Hospedado</Insignia> : null}
                        {esDemostracion ? (
                          <Insignia tono="neutro">Demo</Insignia>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {huesped.profesion || 'Sin profesión'} · {huesped.nacionalidad}
                      </p>
                    </Td>
                    <Td className="text-xs">
                      <span className="text-muted-foreground">{huesped.tipo_identificacion}</span>
                      <p className="num font-medium">{huesped.numero_identificacion}</p>
                    </Td>
                    <Td className="text-xs">
                      <span className="num">{huesped.telefono}</span>
                      {huesped.email ? (
                        <p className="text-muted-foreground">{huesped.email}</p>
                      ) : null}
                    </Td>
                    <Td className="text-xs">
                      <span>{huesped.ciudad_residencia || '—'}</span>
                      {huesped.pais_residencia && huesped.pais_residencia !== 'Colombia' ? (
                        <p className="text-muted-foreground">{huesped.pais_residencia}</p>
                      ) : null}
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      {formatoFecha(huesped.fecha_nacimiento)}
                      {anios !== null ? (
                        <span className="text-muted-foreground"> · {anios} años</span>
                      ) : null}
                    </Td>
                    <Td className="num text-right">{visitas(huesped.id)}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <div className="inline-flex gap-1">
                        <Boton
                          variante="fantasma"
                          icono="lapiz"
                          aria-label={`Editar ${huesped.nombre_completo}`}
                          onClick={() => abrir(huesped)}
                        />
                        {esAdmin ? (
                          <Boton
                            variante="fantasma"
                            icono="basura"
                            aria-label={`Eliminar ${huesped.nombre_completo}`}
                            onClick={() => setBorrando(huesped)}
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
        abierto={abierto}
        titulo={editando ? 'Editar huésped' : 'Registrar huésped'}
        descripcion="Los datos quedan guardados para futuras estancias."
        ancho="max-w-4xl"
        alCerrar={() => setAbierto(false)}
      >
        <form onSubmit={guardar} className="space-y-4 p-5">
          {errores.general ? <Aviso>{errores.general}</Aviso> : null}
          <FormularioHuesped valor={formulario} alCambiar={setFormulario} errores={errores} />
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Boton type="button" variante="contorno" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={ocupado}>
              {ocupado ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar'}
            </Boton>
          </div>
        </form>
      </Modal>

      <Modal
        abierto={borrando !== null}
        titulo="Eliminar huésped"
        ancho="max-w-md"
        alCerrar={() => setBorrando(null)}
      >
        <div className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            ¿Confirma eliminar a{' '}
            <span className="text-foreground">{borrando?.nombre_completo}</span>? Solo es posible si
            no tiene estancias ni registros TRA en el historial.
          </p>
          <div className="flex justify-end gap-2">
            <Boton variante="contorno" onClick={() => setBorrando(null)}>
              Cancelar
            </Boton>
            <Boton variante="peligro" onClick={() => void eliminar()}>
              Eliminar
            </Boton>
          </div>
        </div>
      </Modal>
    </div>
  )
}
