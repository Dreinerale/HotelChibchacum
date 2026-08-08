/**
 * Reportes y exportaciones — incluye CSV TRA Colombia y CSV de ocupación/ingresos.
 * La exportación de CSV está restringida a usuarios con rol administrador.
 */

import { useMemo, useState } from 'react'
import { useApp } from '../app/store'
import Icono from '../components/Icono'
import { Aviso, Boton, Campo, Entrada, Fila, Panel, Selector, Tabla, Td, Th, Vacio } from '../components/ui'
import { repositorio } from '../data'
import { formatoFecha, hoyISO, moneda, numero } from '../domain/utils'

type Informe = 'diaria' | 'mensual' | 'ingresos' | 'huespedes' | 'tra' | 'ocupacion'

const INFORMES: { clave: Informe; titulo: string; detalle: string; soloAdmin?: boolean }[] = [
  { clave: 'diaria', titulo: 'Ocupación diaria', detalle: 'Habitaciones-noche vendidas por día' },
  { clave: 'mensual', titulo: 'Ocupación mensual', detalle: 'Promedio por mes del rango' },
  { clave: 'ingresos', titulo: 'Ingresos por fechas', detalle: 'Pagos recibidos y método' },
  { clave: 'huespedes', titulo: 'Historial de huéspedes', detalle: 'Estancias y consumo por persona' },
  { clave: 'tra', titulo: 'Exportación TRA', detalle: 'Excel para registro oficial MinCIT — solo admin', soloAdmin: true },
  { clave: 'ocupacion', titulo: 'Ocupación e ingresos', detalle: 'CSV administrativo completo — solo admin', soloAdmin: true },
]

function dias(desde: string, hasta: string): string[] {
  const salida: string[] = []
  const cursor = new Date(`${desde}T00:00:00`)
  const fin = new Date(`${hasta}T00:00:00`)
  while (cursor <= fin && salida.length < 400) {
    salida.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return salida
}

function descargarCSV(nombre: string, encabezados: string[], filas: (string | number | null)[][]): void {
  const escapar = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const contenido = [encabezados, ...filas].map((f) => f.map(escapar).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${nombre}.csv`
  enlace.click()
  URL.revokeObjectURL(url)
}

interface ColumnaExcel {
  titulo: string
  ancho: number
}

function descargarExcelBonito(
  nombre: string,
  columnas: ColumnaExcel[],
  filas: (string | number | null)[][],
): void {
  const escapar = (v: string | number | null) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const cols = columnas.map((c) => `<col style="width:${c.ancho * 7}px" />`).join('')

  const encabezado = columnas
    .map(
      (c) =>
        `<th style="background:#8B5E34;color:#ffffff;font-weight:bold;padding:8px 10px;border:1px solid #5A3B1F;text-align:center;white-space:nowrap;font-family:Calibri,Arial,sans-serif;">${escapar(c.titulo)}</th>`,
    )
    .join('')

  const cuerpo = filas
    .map((fila, i) => {
      const fondo = i % 2 === 0 ? '#ffffff' : '#FAF7F2'
      const celdas = fila
        .map(
          (v) =>
            `<td style="background:${fondo};padding:6px 10px;border:1px solid #E0DCD5;font-family:Calibri,Arial,sans-serif;font-size:12px;">${escapar(v)}</td>`,
        )
        .join('')
      return `<tr>${celdas}</tr>`
    })
    .join('')

  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8" />' +
    '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
    '<x:Name>Registro TRA</x:Name>' +
    '<x:WorksheetOptions><x:FreezePanes/><x:FrozenNoSplit/><x:SplitHorizontal>1</x:SplitHorizontal><x:TopRowBottomPane>1</x:TopRowBottomPane></x:WorksheetOptions>' +
    '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
    '</head><body>' +
    `<table border="0" cellspacing="0" cellpadding="0"><colgroup>${cols}</colgroup>` +
    `<thead><tr>${encabezado}</tr></thead><tbody>${cuerpo}</tbody></table>` +
    '</body></html>'

  const url = URL.createObjectURL(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `${nombre}.xls`
  enlace.click()
  URL.revokeObjectURL(url)
}

function Barra({ valor, maximo, etiqueta }: { valor: number; maximo: number; etiqueta: string }) {
  const ancho = maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${ancho}%` }} />
      </div>
      <span className="num w-16 shrink-0 text-right text-xs text-muted-foreground">{etiqueta}</span>
    </div>
  )
}

export default function Reportes() {
  const { detalladas, pagos, habitaciones, huespedes, registrosDetallados, esAdmin, usuario } = useApp()
  const [informe, setInforme] = useState<Informe>('diaria')

  const inicioMes = `${hoyISO().slice(0, 7)}-01`
  const [desde, setDesde] = useState(inicioMes)
  const [hasta, setHasta] = useState(hoyISO())

  // Filtros extra para exportaciones TRA
  const [filtroNacionalidad, setFiltroNacionalidad] = useState('')
  const [filtroHabitacion, setFiltroHabitacion] = useState(0)
  const [filtroEstadoTRA, setFiltroEstadoTRA] = useState('')

  const [mensajeExport, setMensajeExport] = useState('')

  const ocupacionPorDia = useMemo(() => {
    const conteo = new Map<string, number>()
    for (const dia of dias(desde, hasta)) conteo.set(dia, 0)
    for (const estancia of detalladas) {
      const inicio = new Date(estancia.fecha_ingreso)
      const fin = new Date(estancia.fecha_salida_real ?? estancia.fecha_salida_estimada)
      const cursor = new Date(inicio)
      cursor.setHours(0, 0, 0, 0)
      let guardas = 0
      while (cursor < fin && guardas < 400) {
        const clave = new Date(cursor.getTime() - cursor.getTimezoneOffset() * 60_000)
          .toISOString().slice(0, 10)
        if (conteo.has(clave)) conteo.set(clave, (conteo.get(clave) ?? 0) + 1)
        cursor.setDate(cursor.getDate() + 1)
        guardas += 1
      }
    }
    return [...conteo.entries()].map(([dia, ocupadas]) => ({
      dia,
      ocupadas,
      porcentaje: habitaciones.length ? Math.round((ocupadas / habitaciones.length) * 100) : 0,
    }))
  }, [detalladas, desde, hasta, habitaciones.length])

  const ocupacionMensual = useMemo(() => {
    const grupos = new Map<string, { suma: number; dias: number }>()
    for (const fila of ocupacionPorDia) {
      const mes = fila.dia.slice(0, 7)
      const actual = grupos.get(mes) ?? { suma: 0, dias: 0 }
      grupos.set(mes, { suma: actual.suma + fila.porcentaje, dias: actual.dias + 1 })
    }
    return [...grupos.entries()].map(([mes, v]) => ({
      mes,
      promedio: Math.round(v.suma / Math.max(1, v.dias)),
      dias: v.dias,
    }))
  }, [ocupacionPorDia])

  const ingresos = useMemo(() => {
    const enRango = pagos.filter((p) => {
      const dia = p.fecha.slice(0, 10)
      return dia >= desde && dia <= hasta
    })
    const porDia = new Map<string, number>()
    const porMetodo = new Map<string, number>()
    for (const p of enRango) {
      const dia = p.fecha.slice(0, 10)
      porDia.set(dia, (porDia.get(dia) ?? 0) + p.monto)
      porMetodo.set(p.metodo_pago, (porMetodo.get(p.metodo_pago) ?? 0) + p.monto)
    }
    return {
      total: enRango.reduce((s, p) => s + p.monto, 0),
      cantidad: enRango.length,
      porDia: [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      porMetodo: [...porMetodo.entries()].sort((a, b) => b[1] - a[1]),
    }
  }, [pagos, desde, hasta])

  const porHuesped = useMemo(
    () =>
      huespedes
        .map((h) => {
          const suyas = detalladas.filter((e) => e.huesped_id === h.id)
          return {
            huesped: h,
            estancias: suyas.length,
            noches: suyas.reduce((s, e) => s + (e.noches ?? 0), 0),
            facturado: suyas.reduce((s, e) => s + (e.total ?? 0), 0),
            ultima: suyas.map((e) => e.fecha_ingreso).sort().at(-1) ?? '',
          }
        })
        .filter((f) => f.estancias > 0)
        .sort((a, b) => b.facturado - a.facturado),
    [huespedes, detalladas],
  )

  const registrosFiltradosTRA = useMemo(() => {
    return registrosDetallados.filter((r) => {
      const ci = r.check_in_at.slice(0, 10)
      if (ci < desde || ci > hasta) return false
      if (filtroEstadoTRA && r.estado_registro !== filtroEstadoTRA) return false
      if (filtroHabitacion && r.habitacion_id !== filtroHabitacion) return false
      if (filtroNacionalidad && !r.huesped?.nacionalidad.toLowerCase().includes(filtroNacionalidad.toLowerCase())) return false
      return true
    })
  }, [registrosDetallados, desde, hasta, filtroEstadoTRA, filtroHabitacion, filtroNacionalidad])

  const registrarAuditoria = async (tipo: string, filtros: Record<string, unknown>, numRegistros: number) => {
    try {
      await repositorio.registrarExportacion({
        usuario_id: usuario?.id ?? null,
        tipo_reporte: tipo,
        filtros: JSON.stringify(filtros),
        num_registros: numRegistros,
        generado_en: new Date().toISOString(),
      })
    } catch {
      // Silencioso — la auditoría no debe bloquear la exportación
    }
  }

  const estadoLegible: Record<string, string> = {
    borrador: 'Incompleto',
    activo: 'Activo',
    checkout_realizado: 'Check-out realizado',
    anulado: 'Anulado',
  }

  const exportarTRA = async () => {
    if (!esAdmin) {
      setMensajeExport('Solo los administradores pueden exportar el Excel TRA.')
      return
    }
    const nombreArchivo = `registro_alojamiento_TRA_${desde}_a_${hasta}`
    // Mismos datos mínimos exigidos por MinCIT (TRA Colombia), con encabezados legibles
    const columnas: ColumnaExcel[] = [
      { titulo: 'Tipo de identificación', ancho: 22 },
      { titulo: 'Número de identificación', ancho: 20 },
      { titulo: 'Primer nombre', ancho: 16 },
      { titulo: 'Segundo nombre', ancho: 16 },
      { titulo: 'Primer apellido', ancho: 16 },
      { titulo: 'Segundo apellido', ancho: 16 },
      { titulo: 'Nacionalidad', ancho: 16 },
      { titulo: 'Ciudad de residencia', ancho: 18 },
      { titulo: 'Ciudad de procedencia', ancho: 18 },
      { titulo: 'Motivo del viaje', ancho: 16 },
      { titulo: 'N.º habitación', ancho: 14 },
      { titulo: 'Tipo de huésped', ancho: 16 },
      { titulo: 'Fecha check-in', ancho: 14 },
      { titulo: 'Fecha check-out', ancho: 14 },
      { titulo: 'Acompañantes', ancho: 14 },
      { titulo: 'Estado del registro', ancho: 18 },
      { titulo: 'ID de registro', ancho: 14 },
      { titulo: 'Fecha de creación', ancho: 16 },
    ]
    const filas = registrosFiltradosTRA.map((r) => {
      const h = r.huesped
      return [
        h?.tipo_identificacion ?? '',
        h?.numero_identificacion ?? '',
        h?.primer_nombre ?? '',
        h?.segundo_nombre ?? '',
        h?.primer_apellido ?? '',
        h?.segundo_apellido ?? '',
        h?.nacionalidad ?? '',
        h?.ciudad_residencia ?? '',
        r.ciudad_procedencia,
        r.motivo_viaje,
        r.habitacion?.numero ?? '',
        r.es_huesped_principal ? 'Principal' : 'Acompañante',
        r.check_in_at.slice(0, 10),
        r.check_out_at?.slice(0, 10) ?? '',
        r.acompanantes,
        estadoLegible[r.estado_registro] ?? r.estado_registro,
        r.id,
        r.created_at.slice(0, 10),
      ]
    })
    descargarExcelBonito(nombreArchivo, columnas, filas)
    await registrarAuditoria('TRA', { desde, hasta, filtroEstadoTRA, filtroHabitacion, filtroNacionalidad }, filas.length)
    setMensajeExport(`Excel TRA exportado: ${filas.length} registros.`)
  }

  const exportarOcupacion = async () => {
    if (!esAdmin) {
      setMensajeExport('Solo los administradores pueden exportar CSV de ocupación.')
      return
    }
    const nombreArchivo = `ocupacion_e_ingresos_${desde}_a_${hasta}`
    const encabezados = [
      'fecha', 'habitacion', 'tipo_habitacion', 'estado', 'huesped_principal',
      'documento', 'check_in', 'check_out_estimado', 'check_out_real',
      'noches', 'tarifa_noche', 'total_estadia', 'pagado', 'saldo',
      'medio_pago', 'usuario_registro',
    ]
    const enRango = detalladas.filter((e) => {
      const ci = e.fecha_ingreso.slice(0, 10)
      return ci >= desde && ci <= hasta
    })
    const filas = enRango.map((e) => {
      const total = e.total ?? (e.noches ?? 0) * e.valor_noche
      const saldo = total - e.pagado
      return [
        e.fecha_ingreso.slice(0, 10),
        e.habitacion?.numero ?? '',
        e.habitacion?.tipo ?? '',
        e.estado === 'activa' ? 'Activa' : 'Finalizada',
        e.huesped?.nombre_completo ?? '',
        `${e.huesped?.tipo_identificacion ?? ''} ${e.huesped?.numero_identificacion ?? ''}`.trim(),
        e.fecha_ingreso.slice(0, 16),
        e.fecha_salida_estimada.slice(0, 10),
        e.fecha_salida_real?.slice(0, 10) ?? '',
        e.noches ?? '',
        e.valor_noche,
        total,
        e.pagado,
        saldo,
        e.metodo_pago,
        String(e.usuario_id ?? ''),
      ]
    })
    descargarCSV(nombreArchivo, encabezados, filas)
    await registrarAuditoria('Ocupación', { desde, hasta }, filas.length)
    setMensajeExport(`CSV de ocupación exportado: ${filas.length} registros.`)
  }

  const exportar = () => {
    if (informe === 'tra') { void exportarTRA(); return }
    if (informe === 'ocupacion') { void exportarOcupacion(); return }
    if (informe === 'diaria') {
      descargarCSV(
        `ocupacion-diaria_${desde}_${hasta}`,
        ['Fecha', 'Habitaciones ocupadas', 'Total habitaciones', 'Ocupación %'],
        ocupacionPorDia.map((f) => [f.dia, f.ocupadas, habitaciones.length, f.porcentaje]),
      )
    } else if (informe === 'mensual') {
      descargarCSV(
        `ocupacion-mensual_${desde}_${hasta}`,
        ['Mes', 'Días evaluados', 'Ocupación promedio %'],
        ocupacionMensual.map((f) => [f.mes, f.dias, f.promedio]),
      )
    } else if (informe === 'ingresos') {
      descargarCSV(
        `ingresos_${desde}_${hasta}`,
        ['Fecha', 'Ingresos COP'],
        ingresos.porDia.map(([dia, monto]) => [dia, monto]),
      )
    } else {
      descargarCSV(
        'historial-huespedes',
        ['Huésped', 'Tipo ID', 'Documento', 'Estancias', 'Noches', 'Facturado COP', 'Última visita'],
        porHuesped.map((f) => [
          f.huesped.nombre_completo,
          f.huesped.tipo_identificacion,
          f.huesped.numero_identificacion,
          f.estancias,
          f.noches,
          f.facturado,
          f.ultima.slice(0, 10),
        ]),
      )
    }
  }

  const maxDia = Math.max(1, ...ocupacionPorDia.map((f) => f.ocupadas))
  const maxIngreso = Math.max(1, ...ingresos.porDia.map(([, monto]) => monto))
  const seleccionado = INFORMES.find((i) => i.clave === informe)!
  const visibles = INFORMES.filter((i) => !i.soloAdmin || esAdmin)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl leading-tight">Reportes y exportaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Indicadores de operación y exportaciones
          </p>
        </div>
        <Boton variante="contorno" icono="descarga" onClick={exportar}>
          {informe === 'tra' ? 'Exportar Excel' : 'Exportar CSV'}
        </Boton>
      </header>

      {mensajeExport ? <Aviso tipo="ok">{mensajeExport}</Aviso> : null}

      {/* Aviso TRA si corresponde */}
      {(informe === 'tra' || informe === 'ocupacion') && (
        <div className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50/80 px-4 py-3 dark:border-amber-700/40 dark:bg-amber-900/20">
          <Icono nombre="info" className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            <strong>Aviso legal:</strong> Este archivo es un documento interno de preparación.
            El establecimiento debe verificar y realizar el reporte oficial según los canales y plazos
            vigentes de MinCIT/iNNpulsa. Cada exportación queda registrada en el log de auditoría.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibles.map((item) => (
          <button
            key={item.clave}
            onClick={() => setInforme(item.clave)}
            className={`rounded-lg border p-4 text-left transition-colors duration-150 ${
              informe === item.clave
                ? 'border-primary bg-primary/8'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <p className="font-serif text-base leading-tight">{item.titulo}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.detalle}</p>
          </button>
        ))}
      </div>

      <Panel titulo={seleccionado.titulo} descripcion={seleccionado.detalle}>
        <div className={`grid gap-3 border-b border-border px-5 py-4 ${informe === 'tra' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:max-w-md'}`}>
          <Campo etiqueta="Desde">
            <Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </Campo>
          <Campo etiqueta="Hasta">
            <Entrada type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </Campo>
          {informe === 'tra' && (
            <>
              <Campo etiqueta="Estado TRA">
                <Selector value={filtroEstadoTRA} onChange={(e) => setFiltroEstadoTRA(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="borrador">Borrador</option>
                  <option value="activo">Activo</option>
                  <option value="checkout_realizado">Check-out realizado</option>
                  <option value="anulado">Anulado</option>
                </Selector>
              </Campo>
              <Campo etiqueta="Habitación">
                <Selector value={filtroHabitacion} onChange={(e) => setFiltroHabitacion(Number(e.target.value))}>
                  <option value={0}>Todas</option>
                  {habitaciones.map((h) => (
                    <option key={h.id} value={h.id}>{h.numero} · {h.tipo}</option>
                  ))}
                </Selector>
              </Campo>
              <Campo etiqueta="Nacionalidad" className="sm:col-span-2 lg:col-span-2">
                <Entrada
                  value={filtroNacionalidad}
                  onChange={(e) => setFiltroNacionalidad(e.target.value)}
                  placeholder="Colombiana, Venezolana…"
                />
              </Campo>
            </>
          )}
        </div>

        {informe === 'tra' ? (
          <div>
            {!esAdmin ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Solo los administradores pueden acceder a la exportación TRA.
                </p>
              </div>
            ) : registrosFiltradosTRA.length === 0 ? (
              <Vacio
                titulo="Sin registros en el rango"
                mensaje="No hay registros TRA para los filtros seleccionados."
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
                  {[
                    ['Registros', numero(registrosFiltradosTRA.length)],
                    ['Principales', numero(registrosFiltradosTRA.filter((r) => r.es_huesped_principal).length)],
                    ['Acompañantes', numero(registrosFiltradosTRA.filter((r) => !r.es_huesped_principal).length)],
                  ].map(([clave, valor]) => (
                    <div key={clave} className="bg-card px-5 py-3">
                      <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">{clave}</p>
                      <p className="num mt-1 text-lg">{valor}</p>
                    </div>
                  ))}
                </div>
                <Tabla>
                  <thead>
                    <tr>
                      <Th>Huésped</Th>
                      <Th>Tipo</Th>
                      <Th>Habitación</Th>
                      <Th>Procedencia</Th>
                      <Th>Motivo</Th>
                      <Th>Check-in</Th>
                      <Th>Check-out</Th>
                      <Th>Estado</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosFiltradosTRA.map((r) => (
                      <Fila key={r.id}>
                        <Td className="text-sm font-medium">
                          {r.huesped?.nombre_completo ?? `#${r.huesped_id}`}
                          <p className="num text-xs text-muted-foreground">
                            {r.huesped?.tipo_identificacion} {r.huesped?.numero_identificacion}
                          </p>
                        </Td>
                        <Td className="text-xs">{r.es_huesped_principal ? 'Principal' : 'Acompañante'}</Td>
                        <Td className="num text-xs">{r.habitacion?.numero}</Td>
                        <Td className="text-xs">{r.ciudad_procedencia || <span className="text-amber-600">—</span>}</Td>
                        <Td className="text-xs">{r.motivo_viaje}</Td>
                        <Td className="num text-xs">{formatoFecha(r.check_in_at)}</Td>
                        <Td className="num text-xs">{r.check_out_at ? formatoFecha(r.check_out_at) : '—'}</Td>
                        <Td className="text-xs capitalize">{r.estado_registro.replace('_', ' ')}</Td>
                      </Fila>
                    ))}
                  </tbody>
                </Tabla>
              </>
            )}
          </div>
        ) : informe === 'ocupacion' ? (
          <div>
            {!esAdmin ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Solo los administradores pueden acceder a este reporte.
                </p>
              </div>
            ) : (() => {
              const enRango = detalladas.filter((e) => e.fecha_ingreso.slice(0, 10) >= desde && e.fecha_ingreso.slice(0, 10) <= hasta)
              const totalIngresado = enRango.reduce((s, e) => s + e.pagado, 0)
              const totalEstimado = enRango.reduce((s, e) => s + (e.total ?? e.noches ?? 0) * (e.total ? 1 : e.valor_noche), 0)
              return (
                <>
                  <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                    {[
                      ['Estancias en rango', numero(enRango.length)],
                      ['Activas', numero(enRango.filter((e) => e.estado === 'activa').length)],
                      ['Ingresos recibidos', moneda(totalIngresado)],
                      ['Saldo pendiente', moneda(Math.max(0, totalEstimado - totalIngresado))],
                    ].map(([clave, valor]) => (
                      <div key={clave} className="bg-card px-5 py-3">
                        <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">{clave}</p>
                        <p className="num mt-1 text-lg">{valor}</p>
                      </div>
                    ))}
                  </div>
                  {enRango.length === 0 ? (
                    <Vacio titulo="Sin estancias en el rango" mensaje="No hay estancias en las fechas seleccionadas." />
                  ) : (
                    <Tabla>
                      <thead>
                        <tr>
                          <Th>Fecha</Th>
                          <Th>Habitación</Th>
                          <Th>Huésped</Th>
                          <Th>Check-in</Th>
                          <Th>Check-out est.</Th>
                          <Th>Check-out real</Th>
                          <Th className="text-right">Noches</Th>
                          <Th className="text-right">Tarifa</Th>
                          <Th className="text-right">Total</Th>
                          <Th className="text-right">Pagado</Th>
                          <Th className="text-right">Saldo</Th>
                          <Th>Estado</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {enRango.map((e) => {
                          const total = e.total ?? (e.noches ?? 0) * e.valor_noche
                          const saldo = total - e.pagado
                          return (
                            <Fila key={e.id}>
                              <Td className="text-xs">{formatoFecha(e.fecha_ingreso)}</Td>
                              <Td className="num text-xs">{e.habitacion?.numero}</Td>
                              <Td className="text-xs font-medium">{e.huesped?.nombre_completo}</Td>
                              <Td className="num text-xs">{e.fecha_ingreso.slice(0, 10)}</Td>
                              <Td className="num text-xs">{e.fecha_salida_estimada.slice(0, 10)}</Td>
                              <Td className="num text-xs">{e.fecha_salida_real?.slice(0, 10) ?? '—'}</Td>
                              <Td className="num text-right text-xs">{e.noches ?? '—'}</Td>
                              <Td className="num text-right text-xs">{moneda(e.valor_noche)}</Td>
                              <Td className="num text-right text-xs">{total ? moneda(total) : '—'}</Td>
                              <Td className="num text-right text-xs">{moneda(e.pagado)}</Td>
                              <Td className={`num text-right text-xs ${saldo > 0 ? 'text-primary' : ''}`}>
                                {total ? moneda(saldo) : '—'}
                              </Td>
                              <Td className="text-xs capitalize">{e.estado}</Td>
                            </Fila>
                          )
                        })}
                      </tbody>
                    </Tabla>
                  )}
                </>
              )
            })()}
          </div>
        ) : informe === 'diaria' ? (
          <Tabla>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th className="text-right">Ocupadas</Th>
                <Th className="text-right">Disponibles</Th>
                <Th className="w-1/2">Ocupación</Th>
              </tr>
            </thead>
            <tbody>
              {ocupacionPorDia.map((fila) => (
                <Fila key={fila.dia}>
                  <Td className="text-sm whitespace-nowrap">{formatoFecha(fila.dia)}</Td>
                  <Td className="num text-right">{fila.ocupadas}</Td>
                  <Td className="num text-right text-muted-foreground">
                    {Math.max(0, habitaciones.length - fila.ocupadas)}
                  </Td>
                  <Td><Barra valor={fila.ocupadas} maximo={maxDia} etiqueta={`${fila.porcentaje}%`} /></Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        ) : informe === 'mensual' ? (
          <Tabla>
            <thead>
              <tr>
                <Th>Mes</Th>
                <Th className="text-right">Días evaluados</Th>
                <Th className="w-1/2">Ocupación promedio</Th>
              </tr>
            </thead>
            <tbody>
              {ocupacionMensual.map((fila) => (
                <Fila key={fila.mes}>
                  <Td className="text-sm">
                    {new Date(`${fila.mes}-01T00:00:00`).toLocaleDateString('es-CO', {
                      month: 'long', year: 'numeric',
                    })}
                  </Td>
                  <Td className="num text-right">{fila.dias}</Td>
                  <Td><Barra valor={fila.promedio} maximo={100} etiqueta={`${fila.promedio}%`} /></Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        ) : informe === 'ingresos' ? (
          <div>
            <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
              {[
                ['Total recaudado', moneda(ingresos.total)],
                ['Pagos registrados', numero(ingresos.cantidad)],
                ['Promedio por pago', moneda(ingresos.cantidad ? ingresos.total / ingresos.cantidad : 0)],
              ].map(([clave, valor]) => (
                <div key={clave} className="bg-card px-5 py-3">
                  <p className="font-mono text-[9px] tracking-[0.14em] text-muted-foreground uppercase">{clave}</p>
                  <p className="num mt-1 text-lg">{valor}</p>
                </div>
              ))}
            </div>
            {ingresos.porMetodo.length > 0 && (
              <div className="border-b border-border px-5 py-4">
                <p className="mb-3 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  Por método de pago
                </p>
                <div className="flex flex-wrap gap-2">
                  {ingresos.porMetodo.map(([metodo, monto]) => (
                    <span key={metodo} className="rounded-full border border-border px-3 py-1 text-xs">
                      {metodo} · <span className="num">{moneda(monto)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {ingresos.porDia.length === 0 ? (
              <Vacio titulo="Sin ingresos en el rango" mensaje="No se registraron pagos entre las fechas seleccionadas." />
            ) : (
              <Tabla>
                <thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th className="text-right">Ingresos</Th>
                    <Th className="w-1/2"> </Th>
                  </tr>
                </thead>
                <tbody>
                  {ingresos.porDia.map(([dia, monto]) => (
                    <Fila key={dia}>
                      <Td className="text-sm whitespace-nowrap">{formatoFecha(dia)}</Td>
                      <Td className="num text-right">{moneda(monto)}</Td>
                      <Td>
                        <Barra valor={monto} maximo={maxIngreso} etiqueta={`${Math.round((monto / ingresos.total) * 100)}%`} />
                      </Td>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
            )}
          </div>
        ) : porHuesped.length === 0 ? (
          <Vacio titulo="Sin historial" mensaje="Todavía no hay estancias registradas." />
        ) : (
          <Tabla>
            <thead>
              <tr>
                <Th>Huésped</Th>
                <Th>Tipo ID</Th>
                <Th>Documento</Th>
                <Th>Ciudad</Th>
                <Th className="text-right">Estancias</Th>
                <Th className="text-right">Noches</Th>
                <Th className="text-right">Facturado</Th>
                <Th>Última visita</Th>
              </tr>
            </thead>
            <tbody>
              {porHuesped.map((fila) => (
                <Fila key={fila.huesped.id}>
                  <Td className="font-medium">{fila.huesped.nombre_completo}</Td>
                  <Td className="text-xs">{fila.huesped.tipo_identificacion}</Td>
                  <Td className="num text-xs">{fila.huesped.numero_identificacion}</Td>
                  <Td className="text-sm">{fila.huesped.ciudad_residencia || '—'}</Td>
                  <Td className="num text-right">{fila.estancias}</Td>
                  <Td className="num text-right">{fila.noches}</Td>
                  <Td className="num text-right">{moneda(fila.facturado)}</Td>
                  <Td className="text-xs whitespace-nowrap">{formatoFecha(fila.ultima)}</Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        )}
      </Panel>
    </div>
  )
}
