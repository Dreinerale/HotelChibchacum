/** Historial de estancias con búsqueda por nombre, documento, habitación y rango de fechas. */

import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import {
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
import type { EstanciaDetallada } from '../domain/types'
import { calcularNoches, formatoFechaHora, moneda, normalizar } from '../domain/utils'

export default function Historial() {
  const { detalladas, habitaciones } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [habitacion, setHabitacion] = useState('todas')
  const [estado, setEstado] = useState<'todas' | 'activa' | 'finalizada'>('todas')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [detalle, setDetalle] = useState<EstanciaDetallada | null>(null)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda)
    return detalladas.filter((e) => {
      if (q) {
        const campos = [
          e.huesped?.nombre_completo,
          e.huesped?.numero_documento,
          e.habitacion?.numero,
          e.observaciones,
        ]
          .map((v) => normalizar(String(v ?? '')))
          .join(' ')
        if (!campos.includes(q)) return false
      }
      if (habitacion !== 'todas' && String(e.habitacion_id) !== habitacion) return false
      if (estado !== 'todas' && e.estado !== estado) return false
      const dia = e.fecha_ingreso.slice(0, 10)
      if (desde && dia < desde) return false
      if (hasta && dia > hasta) return false
      return true
    })
  }, [detalladas, busqueda, habitacion, estado, desde, hasta])

  const totales = useMemo(
    () => ({
      estancias: filtradas.length,
      noches: filtradas.reduce(
        (s, e) => s + (e.noches ?? calcularNoches(e.fecha_ingreso, new Date().toISOString())),
        0,
      ),
      facturado: filtradas.reduce((s, e) => s + (e.total ?? 0), 0),
      recaudado: filtradas.reduce((s, e) => s + e.pagado, 0),
    }),
    [filtradas],
  )

  const limpiar = () => {
    setBusqueda('')
    setHabitacion('todas')
    setEstado('todas')
    setDesde('')
    setHasta('')
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl leading-tight">Historial</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas las estancias registradas en el hotel
        </p>
      </header>

      <Panel>
        <div className="grid gap-3 border-b border-border px-5 py-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <div className="sm:col-span-2">
            <Campo etiqueta="Búsqueda">
              <Buscador
                valor={busqueda}
                alCambiar={setBusqueda}
                marcador="Nombre, documento, habitación…"
              />
            </Campo>
          </div>
          <Campo etiqueta="Habitación">
            <Selector value={habitacion} onChange={(e) => setHabitacion(e.target.value)}>
              <option value="todas">Todas</option>
              {habitaciones.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.numero} · {h.tipo}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Desde (ingreso)">
            <Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta (ingreso)">
            <Entrada type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
          <div className="flex flex-wrap items-center gap-2 lg:col-span-5">
            {(['todas', 'activa', 'finalizada'] as const).map((valor) => (
              <button
                key={valor}
                onClick={() => setEstado(valor)}
                className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.1em] uppercase transition-colors ${
                  estado === valor
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {valor}
              </button>
            ))}
            <Boton variante="fantasma" onClick={limpiar} className="ml-auto">
              Limpiar filtros
            </Boton>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
          {[
            ['Estancias', String(totales.estancias)],
            ['Noches', String(totales.noches)],
            ['Facturado', moneda(totales.facturado)],
            ['Recaudado', moneda(totales.recaudado)],
          ].map(([clave, valor]) => (
            <div key={clave} className="bg-card px-5 py-3">
              <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                {clave}
              </p>
              <p className="num mt-1 text-lg">{valor}</p>
            </div>
          ))}
        </div>

        {filtradas.length === 0 ? (
          <Vacio
            titulo="Sin resultados"
            mensaje="No hay estancias que coincidan con los filtros seleccionados."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Huésped</Th>
                <Th>Documento</Th>
                <Th>Habitación</Th>
                <Th>Ingreso</Th>
                <Th>Salida</Th>
                <Th className="text-right">Noches</Th>
                <Th className="text-right">Total</Th>
                <Th>Estado</Th>
                <Th className="text-right"> </Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((e) => (
                <Fila key={e.id}>
                  <Td className="font-medium">{e.huesped?.nombre_completo ?? '—'}</Td>
                  <Td className="num text-xs">
                    {e.huesped?.tipo_documento} {e.huesped?.numero_documento}
                  </Td>
                  <Td className="num">{e.habitacion?.numero ?? '—'}</Td>
                  <Td className="text-xs whitespace-nowrap">{formatoFechaHora(e.fecha_ingreso)}</Td>
                  <Td className="text-xs whitespace-nowrap">
                    {e.fecha_salida_real
                      ? formatoFechaHora(e.fecha_salida_real)
                      : `Est. ${formatoFechaHora(e.fecha_salida_estimada)}`}
                  </Td>
                  <Td className="num text-right">{e.noches ?? '—'}</Td>
                  <Td className="num text-right">{e.total !== null ? moneda(e.total) : '—'}</Td>
                  <Td>
                    <Insignia tono={e.estado === 'activa' ? 'activo' : 'cerrado'}>{e.estado}</Insignia>
                  </Td>
                  <Td className="text-right">
                    <Boton variante="fantasma" onClick={() => setDetalle(e)}>
                      Detalle
                    </Boton>
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Panel>

      <Modal
        abierto={detalle !== null}
        titulo={`Estancia #${detalle?.id ?? ''}`}
        descripcion={detalle?.huesped?.nombre_completo}
        alCerrar={() => setDetalle(null)}
      >
        {detalle ? (
          <div className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <section>
                <h3 className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  Huésped
                </h3>
                <dl className="space-y-1 text-sm">
                  <div>{detalle.huesped?.nombre_completo}</div>
                  <div className="num text-xs text-muted-foreground">
                    {detalle.huesped?.tipo_documento} {detalle.huesped?.numero_documento}
                  </div>
                  <div className="num text-xs text-muted-foreground">{detalle.huesped?.telefono}</div>
                  <div className="text-xs text-muted-foreground">{detalle.huesped?.correo}</div>
                  <div className="text-xs text-muted-foreground">
                    {[detalle.huesped?.direccion, detalle.huesped?.ciudad].filter(Boolean).join(', ')}
                  </div>
                  {detalle.huesped?.placa_vehiculo ? (
                    <div className="num text-xs text-muted-foreground">
                      Placa {detalle.huesped.placa_vehiculo}
                    </div>
                  ) : null}
                </dl>
              </section>
              <section>
                <h3 className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  Estancia
                </h3>
                <dl className="space-y-1 text-sm">
                  <div>
                    Habitación <span className="num">{detalle.habitacion?.numero}</span> ·{' '}
                    {detalle.habitacion?.tipo}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ingreso {formatoFechaHora(detalle.fecha_ingreso)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Salida{' '}
                    {detalle.fecha_salida_real
                      ? formatoFechaHora(detalle.fecha_salida_real)
                      : `estimada ${formatoFechaHora(detalle.fecha_salida_estimada)}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {detalle.adultos} adulto(s) · {detalle.ninos} niño(s)
                  </div>
                  <div className="num text-xs text-muted-foreground">
                    {moneda(detalle.valor_noche)} por persona / noche
                  </div>
                </dl>
              </section>
            </div>

            {detalle.observaciones || detalle.observaciones_salida ? (
              <section className="rounded-md border border-border bg-secondary/40 p-3 text-xs">
                {detalle.observaciones ? <p>Ingreso: {detalle.observaciones}</p> : null}
                {detalle.observaciones_salida ? (
                  <p className="mt-1">Salida: {detalle.observaciones_salida}</p>
                ) : null}
              </section>
            ) : null}

            <section>
              <h3 className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                Pagos
              </h3>
              {detalle.pagos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {detalle.pagos.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 py-2">
                      <span className="text-muted-foreground">
                        {p.tipo} · {p.metodo_pago} · {formatoFechaHora(p.fecha)}
                      </span>
                      <span className="num">{moneda(p.monto)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex justify-between border-t border-border pt-3">
                <span className="font-mono text-[10px] tracking-[0.14em] uppercase">Total / pagado</span>
                <span className="num">
                  {moneda(detalle.total ?? 0)} / {moneda(detalle.pagado)}
                </span>
              </div>
            </section>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
