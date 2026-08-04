/**
 * Selección del adaptador de datos.
 *
 * Sin `VITE_API_URL` el sistema opera de forma autónoma en el equipo de
 * recepción. Con la variable definida, todas las operaciones viajan a la API
 * Laravel del servidor del hotel (o de la nube) sin tocar una línea de la UI.
 */

import type { Repositorio } from './repositorio'
import { RepositorioApi } from './repositorioApi'
import { RepositorioLocal } from './repositorioLocal'

const baseUrl = (import.meta.env.VITE_API_URL ?? '').toString().trim().replace(/\/$/, '')

export const repositorio: Repositorio = baseUrl
  ? new RepositorioApi(baseUrl)
  : new RepositorioLocal()

export const usaApi = Boolean(baseUrl)

/** Prepara el almacenamiento local en el primer arranque (no aplica a la API). */
export async function prepararDatos(): Promise<void> {
  if (repositorio instanceof RepositorioLocal) await repositorio.inicializar()
}

export * from './repositorio'
