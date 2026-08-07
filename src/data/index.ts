/**
 * Selección del adaptador de datos.
 *
 * Prioridad:
 *  1. Supabase — cuando el proyecto tiene conexión activa (publicAnonKey disponible)
 *  2. API Laravel — cuando VITE_API_URL está definida
 *  3. Local (localStorage) — modo autónomo sin conexión
 */

import { publicAnonKey } from '../../utils/supabase/info'
import type { Repositorio } from './repositorio'
import { RepositorioApi } from './repositorioApi'
import { RepositorioLocal } from './repositorioLocal'
import { RepositorioSupabase } from './repositorioSupabase'

const baseUrl = (import.meta.env.VITE_API_URL ?? '').toString().trim().replace(/\/$/, '')

function crearRepositorio(): Repositorio {
  if (publicAnonKey) return new RepositorioSupabase()
  if (baseUrl) return new RepositorioApi(baseUrl)
  return new RepositorioLocal()
}

export const repositorio: Repositorio = crearRepositorio()

export const usaApi = Boolean(publicAnonKey) || Boolean(baseUrl)

/** Prepara el almacenamiento local en el primer arranque (no aplica a la API ni a Supabase). */
export async function prepararDatos(): Promise<void> {
  if (repositorio instanceof RepositorioLocal) await repositorio.inicializar()
}

export * from './repositorio'
