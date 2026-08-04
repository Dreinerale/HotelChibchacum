/** Set de iconos de línea, trazo 1.5, dibujados sobre una retícula de 24. */

const trazos: Record<string, string> = {
  panel: 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-4H3zM13 7h8V3h-8z',
  cama: 'M3 18v-7m0 0V6m0 5h11a4 4 0 0 1 4 4v3M3 18h18m0 0v-3M7 8.5h3',
  huesped: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5',
  entrada: 'M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M18 12H9',
  salida: 'M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M8 8l-4 4 4 4M4 12h9',
  historial: 'M12 7v5l3.5 2M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3 4v4h4',
  reporte: 'M4 20V4M4 20h16M8 17V9m4 8v-5m4 5V6',
  usuarios:
    'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.7-4.8 6-4.8S15 17 15 20M16 6.2A3 3 0 0 1 16 12m2 3.6c2 .7 3 2.2 3 4.4',
  sol: 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  luna: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  buscar: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20',
  mas: 'M12 5v14M5 12h14',
  lapiz: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z',
  basura: 'M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v6m4-6v6',
  cerrar: 'M6 6l12 12M18 6 6 18',
  llave: 'M15.5 4a4.5 4.5 0 1 0-3.2 7.7L4 20v0h3v-2h2v-2h1.8l1.5-1.5A4.5 4.5 0 0 0 15.5 4Zm.5 3.5h.01',
  salir: 'M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3m7 4 4 4-4 4m4-4H10',
  dinero: 'M12 5v14M15.5 8.5c0-1.4-1.6-2-3.5-2s-3.5.6-3.5 2 1.6 2 3.5 2.5 3.5 1 3.5 2.5-1.6 2-3.5 2-3.5-.6-3.5-2',
  descarga: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  candado: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
  alerta: 'M12 8v5m0 3h.01M12 3 2.5 20h19L12 3Z',
  chequeo: 'M4 12.5 9.5 18 20 7',
  menu: 'M4 7h16M4 12h16M4 17h16',
  info: 'M12 16v-4m0-4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
}

export type NombreIcono = keyof typeof trazos

export default function Icono({
  nombre,
  className = 'size-[18px]',
}: {
  nombre: string
  className?: string
}) {
  const d = trazos[nombre] ?? trazos.panel
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
