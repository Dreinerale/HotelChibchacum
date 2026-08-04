/** Menú lateral de navegación con logo del establecimiento. */

import logotipo from '@/imports/WhatsApp_Image_2026-08-02_at_10.23.18.jpeg'
import { useApp } from '../app/store'
import Icono from './Icono'

export interface Seccion {
  clave: string
  titulo: string
  icono: string
  soloAdmin?: boolean
  separadorArriba?: boolean
}

export const SECCIONES: Seccion[] = [
  { clave: 'panel', titulo: 'Panel', icono: 'panel' },
  { clave: 'habitaciones', titulo: 'Habitaciones', icono: 'cama' },
  { clave: 'huespedes', titulo: 'Huéspedes', icono: 'huesped' },
  { clave: 'checkin', titulo: 'Check-in', icono: 'entrada' },
  { clave: 'checkout', titulo: 'Check-out', icono: 'salida' },
  { clave: 'historial', titulo: 'Historial', icono: 'historial' },
  { clave: 'registro-tra', titulo: 'Registro TRA', icono: 'reporte', separadorArriba: true },
  { clave: 'reportes', titulo: 'Reportes', icono: 'reporte', soloAdmin: true },
  { clave: 'usuarios', titulo: 'Usuarios', icono: 'usuarios', soloAdmin: true },
]

export default function MenuLateral({
  activa,
  alNavegar,
  abierto,
  alCerrar,
}: {
  activa: string
  alNavegar: (clave: string) => void
  abierto: boolean
  alCerrar: () => void
}) {
  const { usuario, esAdmin, salir, backend } = useApp()
  const visibles = SECCIONES.filter((s) => !s.soloAdmin || esAdmin)

  return (
    <>
      {abierto ? (
        <div
          className="fixed inset-0 z-30 bg-[#1a1614]/40 lg:hidden"
          onClick={alCerrar}
          aria-hidden="true"
        />
      ) : null}

      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo + nombre del establecimiento */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-4">
          <img
            src={logotipo}
            alt="Logo Hotel Chibchacum"
            className="size-12 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold leading-tight">Hotel Chibchacum</p>
            <p className="font-mono text-[9px] tracking-[0.18em] text-muted-foreground uppercase">
              Gestión hotelera
            </p>
          </div>
        </div>

        <ul className="scroll-quiet flex-1 space-y-0.5 overflow-y-auto p-3">
          {visibles.map((seccion) => {
            const esActiva = seccion.clave === activa
            return (
              <li key={seccion.clave}>
                {seccion.separadorArriba ? (
                  <div className="mx-2 my-2 border-t border-border" />
                ) : null}
                <button
                  onClick={() => {
                    alNavegar(seccion.clave)
                    alCerrar()
                  }}
                  aria-current={esActiva ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ${
                    esActiva
                      ? 'bg-secondary font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  }`}
                >
                  <span
                    className={`h-4 w-[2px] rounded-full transition-colors ${esActiva ? 'bg-primary' : 'bg-transparent'}`}
                  />
                  <Icono nombre={seccion.icono} className="size-[17px] shrink-0" />
                  {seccion.titulo}
                  {seccion.clave === 'registro-tra' ? (
                    <span className="ml-auto rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[8px] tracking-wide text-accent uppercase">
                      TRA
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="border-t border-border p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm">{usuario?.nombre}</p>
            <p className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
              {usuario?.rol}
            </p>
          </div>
          <button
            onClick={() => void salir()}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Icono nombre="salir" className="size-4" />
            Cerrar sesión
          </button>
          <p className="mt-2 px-2 text-[10px] leading-snug text-muted-foreground/70">{backend}</p>
        </div>
      </nav>
    </>
  )
}
