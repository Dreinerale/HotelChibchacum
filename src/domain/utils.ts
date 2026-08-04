/** Utilidades de formato y cálculo compartidas por toda la aplicación. */

export const moneda = (valor: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(valor) ? valor : 0)

export const numero = (valor: number): string => new Intl.NumberFormat('es-CO').format(valor)

/** `2026-08-02T14:30` en la zona horaria local, apto para <input type="datetime-local">. */
export function aInputLocal(fecha: Date = new Date()): string {
  const off = fecha.getTimezoneOffset()
  return new Date(fecha.getTime() - off * 60_000).toISOString().slice(0, 16)
}

export const hoyISO = (): string => aInputLocal().slice(0, 10)

export function formatoFecha(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatoFechaHora(valor: string | null | undefined): string {
  if (!valor) return '—'
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Noches facturables entre dos instantes. Se cobra mínimo una noche y se
 * redondea hacia arriba cualquier fracción de día (política habitual en
 * hotelería colombiana).
 */
export function calcularNoches(ingreso: string, salida: string): number {
  const a = new Date(ingreso).getTime()
  const b = new Date(salida).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1
  const dias = Math.ceil((b - a) / 86_400_000)
  return Math.max(1, dias)
}

export const mismaFecha = (valor: string | null | undefined, dia: string): boolean =>
  Boolean(valor) && String(valor).slice(0, 10) === dia

export const edad = (nacimiento: string): number | null => {
  if (!nacimiento) return null
  const n = new Date(nacimiento)
  if (Number.isNaN(n.getTime())) return null
  const hoy = new Date()
  let e = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e -= 1
  return e
}

/** Hash SHA-256 en hexadecimal — usado por el adaptador local para no guardar claves en texto plano. */
export async function hashSHA256(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto)
  const buffer = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
