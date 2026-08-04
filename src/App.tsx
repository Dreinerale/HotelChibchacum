/**
 * Hotel Chibchacum — Sistema de Gestión Hotelera con módulo TRA Colombia.
 */

import { useState } from 'react'
import { ProveedorApp, useApp } from './app/store'
import Icono from './components/Icono'
import MenuLateral, { SECCIONES } from './components/MenuLateral'
import Acceso from './paginas/Acceso'
import CheckIn from './paginas/CheckIn'
import CheckOut from './paginas/CheckOut'
import Habitaciones from './paginas/Habitaciones'
import Historial from './paginas/Historial'
import Huespedes from './paginas/Huespedes'
import PanelPrincipal from './paginas/Panel'
import RegistroTRA from './paginas/RegistroTRA'
import Reportes from './paginas/Reportes'
import Usuarios from './paginas/Usuarios'
import logotipo from '@/imports/WhatsApp_Image_2026-08-02_at_10.23.18.jpeg'

function Aplicacion() {
  const { cargando, usuario, esAdmin, tema, alternarTema, activas, habitaciones } = useApp()
  const [seccion, setSeccion] = useState('panel')
  const [menuAbierto, setMenuAbierto] = useState(false)

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <img src={logotipo} alt="Gestión hotelera" className="size-16 rounded-full object-cover opacity-80" />
          <p className="font-mono text-[11px] tracking-[0.24em] text-muted-foreground uppercase">
            Cargando sistema…
          </p>
        </div>
      </div>
    )
  }

  if (!usuario) return <Acceso />

  const permitida = SECCIONES.find((s) => s.clave === seccion)
  const clave = permitida && (!permitida.soloAdmin || esAdmin) ? seccion : 'panel'

  const vistas: Record<string, React.ReactNode> = {
    panel: <PanelPrincipal alNavegar={setSeccion} />,
    habitaciones: <Habitaciones />,
    huespedes: <Huespedes />,
    checkin: <CheckIn alNavegar={setSeccion} />,
    checkout: <CheckOut alNavegar={setSeccion} />,
    historial: <Historial />,
    'registro-tra': <RegistroTRA alNavegar={setSeccion} />,
    reportes: <Reportes />,
    usuarios: <Usuarios />,
  }

  const disponibles = habitaciones.filter((h) => h.estado === 'Disponible').length

  return (
    <div className="flex min-h-screen bg-background">
      <MenuLateral
        activa={clave}
        alNavegar={setSeccion}
        abierto={menuAbierto}
        alCerrar={() => setMenuAbierto(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-sm sm:px-6">
          <button
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir menú"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground lg:hidden"
          >
            <Icono nombre="menu" className="size-5" />
          </button>

          {/* Logo en header para mobile */}
          <img
            src={logotipo}
            alt="Hotel Chibchacum"
            className="size-7 rounded-full object-cover lg:hidden"
          />

          <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
            {SECCIONES.find((s) => s.clave === clave)?.titulo}
          </p>

          <div className="ml-auto flex items-center gap-4">
            <span className="hidden font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase sm:inline">
              {disponibles} libres · {activas.length} ocupadas
            </span>
            <button
              onClick={alternarTema}
              aria-label={tema === 'claro' ? 'Activar modo oscuro' : 'Activar modo claro'}
              className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} className="size-4" />
            </button>
          </div>
        </header>

        <main className="scroll-quiet flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[88rem]">{vistas[clave]}</div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ProveedorApp>
      <Aplicacion />
    </ProveedorApp>
  )
}
