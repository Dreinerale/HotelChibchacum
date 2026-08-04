/** Primitivas de interfaz compartidas por todos los módulos del PMS. */

import { useEffect, type ReactNode } from 'react'
import type { EstadoHabitacion } from '../domain/types'
import Icono from './Icono'

/* ------------------------------------------------------------------ botón */

type Variante = 'principal' | 'suave' | 'contorno' | 'peligro' | 'fantasma'

const variantes: Record<Variante, string> = {
  principal:
    'bg-primary text-primary-foreground hover:brightness-110 active:brightness-95 shadow-[0_1px_0_rgba(0,0,0,0.06)]',
  suave: 'bg-secondary text-secondary-foreground hover:bg-muted',
  contorno: 'border border-border text-foreground hover:bg-secondary',
  peligro: 'border border-primary/40 text-primary hover:bg-primary/10',
  fantasma: 'text-muted-foreground hover:text-foreground hover:bg-secondary',
}

export function Boton({
  variante = 'principal',
  icono,
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icono?: string }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-[background-color,color,filter,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${variantes[variante]} ${className}`}
    >
      {icono ? <Icono nombre={icono} className="size-4 shrink-0" /> : null}
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- campos */

const baseCampo =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors duration-150 hover:border-primary/40 focus:border-primary focus:outline-none disabled:opacity-60'

export function Campo({
  etiqueta,
  error,
  ayuda,
  requerido,
  className = '',
  children,
}: {
  etiqueta: string
  error?: string
  ayuda?: string
  requerido?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline gap-1 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        {etiqueta}
        {requerido ? <span className="text-primary">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-primary">{error}</span>
      ) : ayuda ? (
        <span className="mt-1 block text-xs text-muted-foreground">{ayuda}</span>
      ) : null}
    </label>
  )
}

export const Entrada = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`${baseCampo} ${props.className ?? ''}`} />
)

export const AreaTexto = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`${baseCampo} resize-y ${props.className ?? ''}`} />
)

export const Selector = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={`${baseCampo} appearance-none pr-8 ${props.className ?? ''}`} />
)

export function Buscador({
  valor,
  alCambiar,
  marcador = 'Buscar…',
}: {
  valor: string
  alCambiar: (v: string) => void
  marcador?: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Icono
        nombre="buscar"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        placeholder={marcador}
        className={`${baseCampo} pl-9`}
      />
    </div>
  )
}

/* --------------------------------------------------------------- entorno */

export function Panel({
  titulo,
  descripcion,
  acciones,
  children,
  className = '',
}: {
  titulo?: string
  descripcion?: string
  acciones?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-lg border border-border bg-card ${className}`}>
      {titulo ? (
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-serif text-lg leading-tight text-card-foreground">{titulo}</h2>
            {descripcion ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>
            ) : null}
          </div>
          {acciones}
        </header>
      ) : null}
      {children}
    </section>
  )
}

const coloresEstado: Record<EstadoHabitacion, string> = {
  Disponible: 'text-state-available border-state-available/35 bg-state-available/10',
  Ocupada: 'text-state-occupied border-state-occupied/35 bg-state-occupied/10',
  Limpieza: 'text-state-cleaning border-state-cleaning/40 bg-state-cleaning/12',
  Mantenimiento: 'text-state-maintenance border-state-maintenance/35 bg-state-maintenance/10',
}

export function EstadoHab({ estado }: { estado: EstadoHabitacion }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase ${coloresEstado[estado]}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {estado}
    </span>
  )
}

export function Insignia({
  children,
  tono = 'neutro',
}: {
  children: ReactNode
  tono?: 'neutro' | 'activo' | 'cerrado' | 'alerta' | 'peligro'
}) {
  const tonos = {
    neutro: 'border-border bg-secondary text-secondary-foreground',
    activo: 'border-accent/40 bg-accent/12 text-accent',
    cerrado: 'border-border bg-muted text-muted-foreground',
    alerta: 'border-amber-400/40 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    peligro: 'border-primary/30 bg-primary/8 text-primary',
  }
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] tracking-[0.1em] uppercase ${tonos[tono]}`}
    >
      {children}
    </span>
  )
}

export function Vacio({ titulo, mensaje, accion }: { titulo: string; mensaje: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <Icono nombre="llave" className="size-7 text-muted-foreground/60" />
      <h3 className="font-serif text-base text-foreground">{titulo}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{mensaje}</p>
      {accion ? <div className="mt-2">{accion}</div> : null}
    </div>
  )
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'border-primary/40 bg-primary/8 text-primary',
    ok: 'border-accent/40 bg-accent/10 text-accent',
    info: 'border-border bg-secondary text-secondary-foreground',
  }
  return (
    <div
      role="status"
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${estilos[tipo]}`}
    >
      <Icono nombre={tipo === 'ok' ? 'chequeo' : 'alerta'} className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* ----------------------------------------------------------------- modal */

export function Modal({
  abierto,
  titulo,
  descripcion,
  ancho = 'max-w-2xl',
  alCerrar,
  children,
}: {
  abierto: boolean
  titulo: string
  descripcion?: string
  ancho?: string
  alCerrar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!abierto) return
    const escuchar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    document.addEventListener('keydown', escuchar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', escuchar)
      document.body.style.overflow = ''
    }
  }, [abierto, alCerrar])

  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div
        className="fixed inset-0 bg-[#1a1614]/45 backdrop-blur-[2px]"
        onClick={alCerrar}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative w-full ${ancho} rounded-lg border border-border bg-card shadow-[0_24px_60px_-24px_rgba(42,35,32,0.45)]`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-serif text-lg leading-tight">{titulo}</h2>
            {descripcion ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>
            ) : null}
          </div>
          <button
            onClick={alCerrar}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Icono nombre="cerrar" className="size-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- tablas */

export const Tabla = ({ children }: { children: ReactNode }) => (
  <div className="scroll-quiet overflow-x-auto">
    <table className="w-full border-collapse text-sm">{children}</table>
  </div>
)

export const Th = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <th
    className={`border-b border-border px-4 py-2.5 text-left font-mono text-[10px] font-medium tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase ${className}`}
  >
    {children}
  </th>
)

export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <td className={`border-b border-border/60 px-4 py-3 align-middle ${className}`}>{children}</td>
)

export const Fila = ({ children }: { children: ReactNode }) => (
  <tr className="transition-colors duration-150 hover:bg-secondary/60">{children}</tr>
)
