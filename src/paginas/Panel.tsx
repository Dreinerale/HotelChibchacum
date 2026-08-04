/** Panel principal: indicadores del día y huéspedes actualmente hospedados. */

import { useMemo } from 'react'
import { useApp } from '../app/store'
import Icono from '../components/Icono'
import { EstadoHab, Fila, Panel as Tarjeta, Tabla, Td, Th, Vacio } from '../components/ui'
import {
  calcularNoches,
  formatoFechaHora,
  hoyISO,
  mismaFecha,
  moneda,
  numero,
} from '../domain/utils'

function Indicador({
  titulo,
  valor,
  detalle,
  icono,
  color,
}: {
  titulo: string
  valor: string
  detalle: string
  icono: string
  color: string
}) {
  return (
    <article className="group relative overflow-hidden rounded-lg border border-border bg-card p-5 transition-colors duration-200 hover:border-primary/35">
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          {titulo}
        </p>
        <Icono nombre={icono} className="size-4 shrink-0" />
      </div>
      <p className="num mt-3 text-4xl leading-none" style={{ color }}>
        {valor}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{detalle}</p>
    </article>
  )
}

export default function PanelPrincipal({ alNavegar }: { alNavegar: (clave: string) => void }) {
  const { habitaciones, activas, detalladas, pagos, usuario } = useApp()
  const hoy = hoyISO()

  const resumen = useMemo(() => {
    const porEstado = (estado: string) => habitaciones.filter((h) => h.estado === estado).length
    const huespedes = activas.reduce((s, e) => s + e.adultos + e.ninos, 0)
    const ingresosHoy = pagos
      .filter((p) => mismaFecha(p.fecha, hoy))
      .reduce((s, p) => s + p.monto, 0)
    return {
      disponibles: porEstado('Disponible'),
      ocupadas: porEstado('Ocupada'),
      limpieza: porEstado('Limpieza'),
      mantenimiento: porEstado('Mantenimiento'),
      huespedes,
      checkins: detalladas.filter((e) => mismaFecha(e.fecha_ingreso, hoy)).length,
      checkouts: detalladas.filter((e) => mismaFecha(e.fecha_salida_real, hoy)).length,
      ingresosHoy,
      ocupacion: habitaciones.length
        ? Math.round((porEstado('Ocupada') / habitaciones.length) * 100)
        : 0,
    }
  }, [habitaciones, activas, detalladas, pagos, hoy])

  const css = getComputedStyle(document.documentElement)
  const c = (nombre: string) => css.getPropertyValue(nombre).trim()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            {new Date().toLocaleDateString('es-CO', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <h1 className="mt-1 font-serif text-3xl leading-tight">
            Buen día, {usuario?.nombre.split(' ')[0]}
          </h1>
        </div>
        <div className="rounded-lg border border-border bg-card px-5 py-3 text-right">
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Ocupación actual
          </p>
          <p className="num text-2xl leading-tight">{resumen.ocupacion}%</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Indicador
          titulo="Disponibles"
          valor={numero(resumen.disponibles)}
          detalle={`de ${numero(habitaciones.length)} habitaciones registradas`}
          icono="cama"
          color={c('--state-available')}
        />
        <Indicador
          titulo="Ocupadas"
          valor={numero(resumen.ocupadas)}
          detalle={`${numero(activas.length)} estancias activas`}
          icono="llave"
          color={c('--state-occupied')}
        />
        <Indicador
          titulo="En limpieza"
          valor={numero(resumen.limpieza)}
          detalle={`${numero(resumen.mantenimiento)} en mantenimiento`}
          icono="chequeo"
          color={c('--state-cleaning')}
        />
        <Indicador
          titulo="Huéspedes hospedados"
          valor={numero(resumen.huespedes)}
          detalle="adultos y niños en el hotel"
          icono="huesped"
          color={c('--foreground')}
        />
        <Indicador
          titulo="Check-ins de hoy"
          valor={numero(resumen.checkins)}
          detalle="ingresos registrados en la fecha"
          icono="entrada"
          color={c('--accent')}
        />
        <Indicador
          titulo="Check-outs de hoy"
          valor={numero(resumen.checkouts)}
          detalle={`${moneda(resumen.ingresosHoy)} recaudados hoy`}
          icono="salida"
          color={c('--primary')}
        />
      </div>

      <Tarjeta
        titulo="Huéspedes hospedados"
        descripcion="Estancias activas con su habitación, acompañantes y consumo acumulado."
      >
        {activas.length === 0 ? (
          <Vacio
            titulo="Sin huéspedes en el hotel"
            mensaje="Cuando registre un check-in, la estancia aparecerá aquí con su habitación y su saldo."
          />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Huésped</Th>
                <Th>Documento</Th>
                <Th>Habitación</Th>
                <Th>Ingreso</Th>
                <Th>Salida estimada</Th>
                <Th className="text-right">Noches</Th>
                <Th className="text-right">Acumulado</Th>
                <Th className="text-right">Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {activas.map((estancia) => {
                const noches = calcularNoches(estancia.fecha_ingreso, new Date().toISOString())
                const acumulado = noches * estancia.valor_noche
                const saldo = acumulado - estancia.pagado
                return (
                  <Fila key={estancia.id}>
                    <Td>
                      <button
                        onClick={() => alNavegar('checkout')}
                        className="text-left font-medium underline-offset-4 hover:text-primary hover:underline"
                      >
                        {estancia.huesped?.nombre_completo ?? '—'}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {estancia.adultos} adulto{estancia.adultos === 1 ? '' : 's'}
                        {estancia.ninos > 0 ? ` · ${estancia.ninos} niño(s)` : ''}
                      </p>
                    </Td>
                    <Td className="num text-xs text-muted-foreground">
                      {estancia.huesped?.tipo_documento} {estancia.huesped?.numero_documento}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="num">{estancia.habitacion?.numero}</span>
                        {estancia.habitacion ? (
                          <EstadoHab estado={estancia.habitacion.estado} />
                        ) : null}
                      </div>
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      {formatoFechaHora(estancia.fecha_ingreso)}
                    </Td>
                    <Td className="text-xs whitespace-nowrap">
                      {formatoFechaHora(estancia.fecha_salida_estimada)}
                    </Td>
                    <Td className="num text-right">{noches}</Td>
                    <Td className="num text-right">{moneda(acumulado)}</Td>
                    <Td
                      className={`num text-right ${saldo > 0 ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {moneda(Math.max(0, saldo))}
                    </Td>
                  </Fila>
                )
              })}
            </tbody>
          </Tabla>
        )}
      </Tarjeta>
    </div>
  )
}
