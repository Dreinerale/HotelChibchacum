/** Pantalla de acceso: inicio de sesión y recuperación de contraseña. */

import fotofachada from '../imports/475786551_3757045577774752_4280862027522278060_n-1.jpg'
import { useState } from 'react'
import { useApp } from '../app/store'
import Icono from '../components/Icono'
import { Aviso, Boton, Campo, Entrada } from '../components/ui'
import { repositorio, usaApi } from '../data'
import { ErrorAplicacion } from '../data/repositorio'

type Vista = 'acceso' | 'solicitar' | 'restablecer'

export default function Acceso() {
  const { entrar, tema, alternarTema } = useApp()
  const [vista, setVista] = useState<Vista>('acceso')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [token, setToken] = useState('')
  const [nuevaClave, setNuevaClave] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const conManejo = (accion: () => Promise<void>) => async (evento: React.FormEvent) => {
    evento.preventDefault()
    setError('')
    setOk('')
    setOcupado(true)
    try {
      await accion()
    } catch (e) {
      setError(e instanceof ErrorAplicacion ? e.message : 'Ocurrió un error inesperado.')
    } finally {
      setOcupado(false)
    }
  }

  const enviarAcceso = conManejo(async () => {
    await entrar(email, clave)
  })

  const enviarSolicitud = conManejo(async () => {
    const codigo = await repositorio.solicitarRecuperacion(email)
    setVista('restablecer')
    setOk(
      codigo
        ? `Código de recuperación generado: ${codigo}. Válido por 30 minutos.`
        : 'Enviamos un código de recuperación al correo registrado.',
    )
  })

  const enviarRestablecer = conManejo(async () => {
    await repositorio.restablecerClave(email, token, nuevaClave)
    setVista('acceso')
    setClave('')
    setToken('')
    setNuevaClave('')
    setOk('Contraseña actualizada. Ya puede iniciar sesión.')
  })

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* Panel editorial: fachada real del hotel. */}
      <aside className="relative hidden overflow-hidden bg-[#1a1210] lg:block">
        <img
          src={fotofachada}
          alt="Fachada del Hotel Chibchacum"
          className="absolute inset-0 size-full object-cover object-[50%_55%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/25 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-12 text-[#f4ece1]">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full border border-[#f4ece1]/40">
              <Icono nombre="llave" className="size-4" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase">Chibchacum</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-serif text-5xl leading-[1.05] font-normal">
              Sistema de gestión
              <span className="block italic text-[#d8b48c]">Hotel Chibchacum</span>
            </h1>
          </div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[#f4ece1]/45 uppercase">
            Acceso seguro · Personal autorizado
          </p>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] text-muted-foreground uppercase">
                {vista === 'acceso' ? 'Acceso al sistema' : 'Recuperar contraseña'}
              </p>
              <h2 className="mt-2 font-serif text-3xl leading-tight">
                {vista === 'acceso'
                  ? 'Bienvenido de nuevo'
                  : vista === 'solicitar'
                    ? 'Solicitar código'
                    : 'Nueva contraseña'}
              </h2>
            </div>
            <button
              onClick={alternarTema}
              aria-label="Cambiar tema"
              className="rounded-md border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Icono nombre={tema === 'claro' ? 'luna' : 'sol'} className="size-4" />
            </button>
          </div>

          {error ? (
            <div className="mb-4">
              <Aviso>{error}</Aviso>
            </div>
          ) : null}
          {ok ? (
            <div className="mb-4">
              <Aviso tipo="ok">{ok}</Aviso>
            </div>
          ) : null}

          {vista === 'acceso' ? (
            <form onSubmit={enviarAcceso} className="space-y-4">
              <Campo etiqueta="Correo" requerido>
                <Entrada
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="recepcion@chibchacum.co"
                />
              </Campo>
              <Campo etiqueta="Contraseña" requerido>
                <Entrada
                  type="password"
                  autoComplete="current-password"
                  required
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder="••••••••"
                />
              </Campo>
              <Boton type="submit" disabled={ocupado} className="w-full">
                {ocupado ? 'Verificando…' : 'Iniciar sesión'}
              </Boton>
              <button
                type="button"
                onClick={() => {
                  setVista('solicitar')
                  setError('')
                  setOk('')
                }}
                className="w-full text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                ¿Olvidó su contraseña?
              </button>
            </form>
          ) : vista === 'solicitar' ? (
            <form onSubmit={enviarSolicitud} className="space-y-4">
              <Campo
                etiqueta="Correo registrado"
                requerido
                ayuda="Se generará un código de un solo uso, válido por 30 minutos."
              >
                <Entrada
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Campo>
              <Boton type="submit" disabled={ocupado} className="w-full">
                {ocupado ? 'Generando…' : 'Enviar código'}
              </Boton>
              <Boton
                type="button"
                variante="fantasma"
                className="w-full"
                onClick={() => setVista('acceso')}
              >
                Volver al acceso
              </Boton>
            </form>
          ) : (
            <form onSubmit={enviarRestablecer} className="space-y-4">
              <Campo etiqueta="Código recibido" requerido>
                <Entrada
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="num tracking-[0.3em]"
                  placeholder="000000"
                />
              </Campo>
              <Campo etiqueta="Nueva contraseña" requerido ayuda="Mínimo 8 caracteres.">
                <Entrada
                  type="password"
                  required
                  minLength={8}
                  value={nuevaClave}
                  onChange={(e) => setNuevaClave(e.target.value)}
                />
              </Campo>
              <Boton type="submit" disabled={ocupado} className="w-full">
                {ocupado ? 'Guardando…' : 'Cambiar contraseña'}
              </Boton>
              <Boton
                type="button"
                variante="fantasma"
                className="w-full"
                onClick={() => setVista('acceso')}
              >
                Volver al acceso
              </Boton>
            </form>
          )}

          {!usaApi ? (
            <p className="mt-8 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Primer arranque: usuario <span className="num text-foreground">admin@chibchacum.co</span>{' '}
              con contraseña <span className="num text-foreground">Chibchacum2026*</span>. Cámbiela
              desde <em>Usuarios</em> apenas ingrese.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  )
}
