/** Administración de usuarios y cambio de contraseña propia (solo administrador). */

import { useEffect, useState } from 'react'
import { useApp } from '../app/store'
import {
  Aviso,
  Boton,
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
} from '../components/ui'
import { repositorio } from '../data'
import { ErrorAplicacion } from '../data/repositorio'
import type { Rol, Usuario } from '../domain/types'
import { formatoFecha } from '../domain/utils'

export default function Usuarios() {
  const { usuario } = useApp()
  const [lista, setLista] = useState<Usuario[]>([])
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState<Rol>('recepcion')
  const [clave, setClave] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [mensaje, setMensaje] = useState('')

  const [claveActual, setClaveActual] = useState('')
  const [claveNueva, setClaveNueva] = useState('')
  const [mensajeClave, setMensajeClave] = useState('')
  const [errorClave, setErrorClave] = useState('')

  const cargar = async () => setLista(await repositorio.listarUsuarios())

  useEffect(() => {
    void cargar()
  }, [])

  const crear = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErrores({})
    try {
      await repositorio.crearUsuario({ nombre, email, rol, activo: true, clave })
      await cargar()
      setAbierto(false)
      setNombre('')
      setEmail('')
      setClave('')
      setMensaje('Usuario creado correctamente.')
    } catch (e) {
      if (e instanceof ErrorAplicacion) {
        setErrores(Object.keys(e.campos).length ? e.campos : { general: e.message })
      }
    }
  }

  const alternarActivo = async (objetivo: Usuario) => {
    await repositorio.actualizarUsuario(objetivo.id, { activo: !objetivo.activo })
    await cargar()
  }

  const eliminar = async (objetivo: Usuario) => {
    try {
      await repositorio.eliminarUsuario(objetivo.id)
      await cargar()
      setMensaje('Usuario eliminado.')
    } catch (e) {
      setMensaje(e instanceof ErrorAplicacion ? e.message : 'No se pudo eliminar.')
    }
  }

  const cambiarClave = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErrorClave('')
    setMensajeClave('')
    try {
      await repositorio.cambiarClave(claveActual, claveNueva)
      setClaveActual('')
      setClaveNueva('')
      setMensajeClave('Contraseña actualizada.')
    } catch (e) {
      setErrorClave(e instanceof ErrorAplicacion ? e.message : 'No se pudo cambiar la contraseña.')
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl leading-tight">Usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuentas con acceso al sistema y sus roles
          </p>
        </div>
        <Boton icono="mas" onClick={() => setAbierto(true)}>
          Nuevo usuario
        </Boton>
      </header>

      {mensaje ? <Aviso tipo="ok">{mensaje}</Aviso> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel titulo="Cuentas registradas">
          <Tabla>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Correo</Th>
                <Th>Rol</Th>
                <Th>Estado</Th>
                <Th>Creado</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {lista.map((cuenta) => (
                <Fila key={cuenta.id}>
                  <Td className="font-medium">
                    {cuenta.nombre}
                    {cuenta.id === usuario?.id ? (
                      <span className="ml-2 text-xs text-muted-foreground">(usted)</span>
                    ) : null}
                  </Td>
                  <Td className="text-sm">{cuenta.email}</Td>
                  <Td>
                    <Insignia tono={cuenta.rol === 'administrador' ? 'activo' : 'neutro'}>
                      {cuenta.rol}
                    </Insignia>
                  </Td>
                  <Td>
                    <Insignia tono={cuenta.activo ? 'activo' : 'cerrado'}>
                      {cuenta.activo ? 'Activo' : 'Inactivo'}
                    </Insignia>
                  </Td>
                  <Td className="text-xs whitespace-nowrap">{formatoFecha(cuenta.creado_en)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {cuenta.id === usuario?.id ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="inline-flex gap-1">
                        <Boton variante="fantasma" onClick={() => void alternarActivo(cuenta)}>
                          {cuenta.activo ? 'Desactivar' : 'Activar'}
                        </Boton>
                        <Boton
                          variante="fantasma"
                          icono="basura"
                          aria-label={`Eliminar ${cuenta.nombre}`}
                          onClick={() => void eliminar(cuenta)}
                        />
                      </div>
                    )}
                  </Td>
                </Fila>
              ))}
            </tbody>
          </Tabla>
        </Panel>

        <Panel titulo="Mi contraseña" descripcion="Cámbiela periódicamente por seguridad.">
          <form onSubmit={cambiarClave} className="space-y-4 p-5">
            {errorClave ? <Aviso>{errorClave}</Aviso> : null}
            {mensajeClave ? <Aviso tipo="ok">{mensajeClave}</Aviso> : null}
            <Campo etiqueta="Contraseña actual" requerido>
              <Entrada
                type="password"
                required
                value={claveActual}
                onChange={(e) => setClaveActual(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Nueva contraseña" requerido ayuda="Mínimo 8 caracteres.">
              <Entrada
                type="password"
                required
                minLength={8}
                value={claveNueva}
                onChange={(e) => setClaveNueva(e.target.value)}
              />
            </Campo>
            <Boton type="submit" className="w-full">
              Actualizar contraseña
            </Boton>
          </form>
        </Panel>
      </div>

      <Modal
        abierto={abierto}
        titulo="Nuevo usuario"
        ancho="max-w-lg"
        alCerrar={() => setAbierto(false)}
      >
        <form onSubmit={crear} className="space-y-4 p-5">
          {errores.general ? <Aviso>{errores.general}</Aviso> : null}
          <Campo etiqueta="Nombre" requerido error={errores.nombre}>
            <Entrada required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Campo>
          <Campo etiqueta="Correo" requerido error={errores.email}>
            <Entrada
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Rol" requerido>
              <Selector value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
                <option value="recepcion">Recepción</option>
                <option value="administrador">Administrador</option>
              </Selector>
            </Campo>
            <Campo etiqueta="Contraseña" requerido error={errores.clave ?? errores.password}>
              <Entrada
                type="password"
                required
                minLength={8}
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
            </Campo>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Boton type="button" variante="contorno" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton type="submit">Crear usuario</Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
