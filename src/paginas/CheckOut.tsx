/**
 * Check-out. Calcula noches y total a pagar, registra el saldo y devuelve la
 * habitación a "Disponible" (o "Limpieza" si se marca la casilla).
 */

import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import {
  AreaTexto,
  Aviso,
  Boton,
  Buscador,
  Campo,
  Entrada,
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
import { METODOS_PAGO, type EstanciaDetallada, type MetodoPago } from '../domain/types'
import { aInputLocal, calcularNoches, formatoFechaHora, moneda, normalizar } from '../domain/utils'

export default function CheckOut({ alNavegar }: { alNavegar: (clave: string) => void }) {
  const { activas, refrescar } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [seleccion, setSeleccion] = useState<EstanciaDetallada | null>(null)
  const [salida, setSalida] = useState(aInputLocal())
  const [metodo, setMetodo] = useState<MetodoPago>('Efectivo')
  const [pagado, setPagado] = useState(0)
  const [observaciones, setObservaciones] = useState('')
  const [limpieza, setLimpieza] = useState(true)
  const [error, setError] = useState('')
  const [comprobante, setComprobante] = useState<EstanciaDetallada | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda)
    if (!q) return activas
    return activas.filter((e) =>
      [e.huesped?.nombre_completo, e.huesped?.numero_documento, e.habitacion?.numero]
        .map((v) => normalizar(String(v ?? '')))
        .some((campo) => campo.includes(q)),
    )
  }, [activas, busqueda])

const abrir = (estancia: EstanciaDetallada) => {
  setSeleccion(estancia)
  setSalida(aInputLocal())
  setMetodo(estancia.metodo_pago)
  setPagado(0) // en blanco: lo llena la administradora según lo que realmente reciba
  setObservaciones('')
  setLimpieza(true)
  setError('')
}

  const noches = seleccion ? calcularNoches(seleccion.fecha_ingreso, salida) : 0
  const totalPersonas = seleccion ? seleccion.adultos + seleccion.ninos : 1
  const total = seleccion ? noches * seleccion.valor_noche * (totalPersonas > 0 ? totalPersonas : 1) : 0
  const saldo = seleccion ? total - seleccion.pagado : 0

  const confirmar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!seleccion) return
    setOcupado(true)
    setError('')
    try {
      const cerrada = await repositorio.checkOut(seleccion.id, {
        fecha_salida_real: salida,
        metodo_pago: metodo,
        observaciones_salida: observaciones,
        monto_pagado: pagado,
        dejar_en_limpieza: limpieza,
      })
      await refrescar()
      setSeleccion(null)
      setComprobante(cerrada)
    } catch (e) {
      setError(e instanceof ErrorAplicacion ? e.message : 'Ocurrió un error inesperado.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl leading-tight">Check-out</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activas.length} estancia(s) activas por cerrar
        </p>
      </header>

      <Panel>
        <div className="border-b border-border px-5 py-4">
          <Buscador
            valor={busqueda}
            alCambiar={setBusqueda}
            marcador="Buscar por huésped, documento o habitación…"
          />
        </div>
        {filtradas.length === 0 ? (
          <Vacio
            titulo={activas.length === 0 ? 'No hay estancias activas' : 'Sin coincidencias'}
            mensaje={
              activas.length === 0
                ? 'Cuando registre un check-in podrá cerrarlo desde aquí.'
                : 'Pruebe con otro nombre o número de habitación.'
            }
            accion={
              activas.length === 0 ? (
                <Boton onClick={() => alNavegar('checkin')}>Ir a Check-in</Boton>
              ) : undefined
            }
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Huésped</Th>
                <Th>Habitación</Th>
                <Th>Ingreso</Th>
                <Th className="text-right">Noches a hoy</Th>
                <Th className="text-right">Personas</Th>
                <Th className="text-right">Precio / persona</Th>
                <Th className="text-right">Abonado</Th>
                <Th className="text-right">Saldo</Th>
                <Th className="text-right"> </Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((estancia) => {
                const n = calcularNoches(estancia.fecha_ingreso, new Date().toISOString())
                const p = estancia.adultos + estancia.ninos
                const pendiente = n * estancia.valor_noche * (p > 0 ? p : 1) - estancia.pagado
                return (
                  <Fila key={estancia.id}>
                    <Td className="font-medium">{estancia.huesped?.nombre_completo ?? '—'}</Td>
                    <Td className="num">{estancia.habitacion?.numero ?? '—'}</Td>
                    <Td className="text-xs whitespace-nowrap">
                      {formatoFechaHora(estancia.fecha_ingreso)}
                    </Td>
                    <Td className="num text-right">{n}</Td>
                    <Td className="num text-right">{estancia.adultos + estancia.ninos}</Td>
                    <Td className="num text-right">{moneda(estancia.valor_noche)}</Td>
                    <Td className="num text-right text-muted-foreground">
                      {moneda(estancia.pagado)}
                    </Td>
                    <Td className="num text-right text-primary">{moneda(Math.max(0, pendiente))}</Td>
                    <Td className="text-right">
                      <Boton variante="suave" icono="salida" onClick={() => abrir(estancia)}>
                        Cerrar
                      </Boton>
                    </Td>
                  </Fila>
                )
              })}
            </tbody>
          </Tabla>
        )}
      </Panel>

      <Modal
        abierto={seleccion !== null}
        titulo="Liquidación de la estancia"
        descripcion={
          seleccion
            ? `${seleccion.huesped?.nombre_completo} · Habitación ${seleccion.habitacion?.numero}`
            : undefined
        }
        alCerrar={() => setSeleccion(null)}
      >
        {seleccion ? (
          <form onSubmit={confirmar} className="space-y-4 p-5">
            {error ? <Aviso>{error}</Aviso> : null}

            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-5">
              {[
                ['Ingreso', formatoFechaHora(seleccion.fecha_ingreso)],
                ['Noches', String(noches)],
                ['Total personas', String(totalPersonas)],
                ['Precio persona / noche', moneda(seleccion.valor_noche)],
                ['Abonado', moneda(seleccion.pagado)],
              ].map(([clave, valor]) => (
                <div key={clave} className="bg-card px-3 py-2.5">
                  <dt className="font-mono text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
                    {clave}
                  </dt>
                  <dd className="num mt-1 text-sm">{valor}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Fecha y hora de salida" requerido>
                <Entrada
                  type="datetime-local"
                  required
                  value={salida}
                  onChange={(e) => setSalida(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Método de pago" requerido>
                <Selector value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                  {METODOS_PAGO.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo
                etiqueta="Monto recibido ahora (COP)"
                ayuda={`Saldo pendiente: ${moneda(Math.max(0, saldo))}`}
              >
                <Entrada
                  type="number"
                  min={0}
                  step={1000}
                  className="num"
                  value={pagado || ''}
                  onChange={(e) => setPagado(Number(e.target.value))}
                />
              </Campo>
              <div className="flex items-end">
                <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm">
                  <input
                    type="checkbox"
                    checked={limpieza}
                    onChange={(e) => setLimpieza(e.target.checked)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  Enviar la habitación a limpieza
                </label>
              </div>
            </div>

            <Campo etiqueta="Observaciones de salida">
              <AreaTexto
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Sin novedades, se devuelve llave, consumo de minibar…"
              />
            </Campo>

            <div className="flex items-baseline justify-between rounded-md bg-secondary/60 px-4 py-3">
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase">Total a pagar</span>
              <span className="num text-2xl text-primary">{moneda(total)}</span>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Boton type="button" variante="contorno" onClick={() => setSeleccion(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={ocupado}>
                {ocupado ? 'Cerrando…' : 'Confirmar check-out'}
              </Boton>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        abierto={comprobante !== null}
        titulo="Check-out completado"
        ancho="max-w-md"
        alCerrar={() => setComprobante(null)}
      >
        {comprobante ? (
          <div className="space-y-4 p-5">
            <Aviso tipo="ok">
              La habitación {comprobante.habitacion?.numero} quedó en estado{' '}
              {comprobante.habitacion?.estado}.
            </Aviso>
            <dl className="divide-y divide-border text-sm">
              {[
                ['Huésped', comprobante.huesped?.nombre_completo ?? '—'],
                ['Salida', formatoFechaHora(comprobante.fecha_salida_real)],
                ['Noches', String(comprobante.noches ?? 0)],
                ['Método de pago', comprobante.metodo_pago],
                ['Total', moneda(comprobante.total ?? 0)],
                ['Pagado', moneda(comprobante.pagado)],
              ].map(([clave, valor]) => (
                <div key={clave} className="flex justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">{clave}</dt>
                  <dd className="num text-right">{valor}</dd>
                </div>
              ))}
            </dl>
            <Boton className="w-full" onClick={() => setComprobante(null)}>
              Entendido
            </Boton>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
