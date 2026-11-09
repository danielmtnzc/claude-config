// Cálculos del registro de consumo: sin llamadas a $, para poder probarlos solos.
import type { PeriodoConsumo } from '../types'

/** Precio por millón de tokens, en dólares. */
export type Precio = {
  entrada: number
  salida: number
  cache_escritura: number
  cache_lectura: number
}

/** Lo que trae precios.json: una entrada por familia de modelo. */
export type Precios = Record<string, Precio>

/** Tokens de una respuesta o de un turno, como los cuenta la API. */
export type Tokens = {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

export const CABECERA =
  'fecha;hora;equipo;proyecto;agente;modelo;entrada;salida;cache_escritura;cache_lectura;coste_usd;limite_semanal_pct'

const DIAS = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá']
const DIA_MS = 86_400_000

/** "claude-haiku-5-5" -> "haiku"; si no reconoce la familia, el id tal cual. */
export function modeloCorto(model: string | undefined): string {
  if (!model) return '?'
  const m = /(haiku|sonnet|opus|fable|mythos)/i.exec(model)

  return m?.[1] ? m[1].toLowerCase() : model
}

/** Coste estimado de unos tokens con el precio de su modelo; undefined si no hay precio. */
export function costeDe(model: string, t: Tokens, precios: Precios): number | undefined {
  const p = precios[modeloCorto(model)]
  if (!p) return undefined

  return (
    (t.input_tokens * p.entrada +
      t.output_tokens * p.salida +
      t.cache_creation_input_tokens * p.cache_escritura +
      t.cache_read_input_tokens * p.cache_lectura) /
    1_000_000
  )
}

function dos(n: number): string {
  return String(n).padStart(2, '0')
}

/** Fecha y hora locales a partir de milisegundos y el desfase en minutos. */
export function fechaLocal(ms: number, offsetMin: number): { fecha: string; hora: string; mes: string } {
  const d = new Date(ms + offsetMin * 60_000)
  const fecha = `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`

  return { fecha, hora: `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}`, mes: fecha.slice(0, 7) }
}

/** Los meses (AAAA-MM) cuyo archivo hace falta leer para las últimas 8 semanas. */
export function mesesRecientes(ms: number, offsetMin: number): string[] {
  const meses = new Set<string>()
  for (let i = 0; i <= 63; i += 7) meses.add(fechaLocal(ms - i * DIA_MS, offsetMin).mes)

  return [...meses]
}

/** Número con coma decimal, como lo lee Excel en español. */
export function decimal(n: number, digits = 4): string {
  return n.toFixed(digits).replace('.', ',')
}

function limpio(s: string): string {
  return s.replace(/[;\r\n]/g, ' ').trim()
}

/** Una línea del CSV. */
export function lineaCsv(f: {
  fecha: string
  hora: string
  equipo: string
  proyecto: string
  agente: string
  modelo: string
  tokens: Tokens
  coste: number | undefined
  limite: number | undefined
}): string {
  return [
    f.fecha,
    f.hora,
    limpio(f.equipo),
    limpio(f.proyecto),
    limpio(f.agente),
    limpio(f.modelo),
    f.tokens.input_tokens,
    f.tokens.output_tokens,
    f.tokens.cache_creation_input_tokens,
    f.tokens.cache_read_input_tokens,
    f.coste === undefined ? '' : decimal(f.coste),
    f.limite === undefined ? '' : decimal(f.limite, 1),
  ].join(';')
}

function numero(s: string | undefined): number | undefined {
  if (s === undefined || s.trim() === '') return undefined
  const n = Number(s.replace(',', '.'))

  return Number.isFinite(n) ? n : undefined
}

function grupo(agente: string): string {
  return agente === 'principal' || agente === 'rapido' || agente === 'experto' ? agente : 'otros'
}

function etiquetaDia(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)

  return `${DIAS[d.getUTCDay()]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`
}

/** Lunes de la semana de una fecha AAAA-MM-DD. */
function lunes(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  const back = (d.getUTCDay() + 6) % 7

  return new Date(d.getTime() - back * DIA_MS).toISOString().slice(0, 10)
}

function sumar(map: Map<string, PeriodoConsumo>, clave: string, etiqueta: string, agente: string, modelo: string, coste: number, limite: number | undefined) {
  let p = map.get(clave)
  if (!p) {
    p = { etiqueta, total: 0, porAgente: {}, opus: 0 }
    map.set(clave, p)
  }
  p.total += coste
  const g = grupo(agente)
  p.porAgente[g] = (p.porAgente[g] ?? 0) + coste
  if (modeloCorto(modelo) === 'opus') p.opus += coste
  if (limite !== undefined) p.limiteMax = Math.max(p.limiteMax ?? 0, limite)
}

/** Resume los CSV: los últimos 14 días y las últimas 8 semanas con datos, lo más reciente primero. */
export function resumir(textos: string[], ms: number, offsetMin: number): { dias: PeriodoConsumo[]; semanas: PeriodoConsumo[] } {
  const hoy = fechaLocal(ms, offsetMin).fecha
  const desdeDia = fechaLocal(ms - 13 * DIA_MS, offsetMin).fecha
  const desdeSemana = lunes(fechaLocal(ms - 7 * 7 * DIA_MS, offsetMin).fecha)
  const dias = new Map<string, PeriodoConsumo>()
  const semanas = new Map<string, PeriodoConsumo>()

  for (const texto of textos) {
    for (const raw of texto.replace(/^﻿/, '').split(/\r?\n/)) {
      const c = raw.split(';')
      if (c.length < 11 || !/^\d{4}-\d{2}-\d{2}$/.test(c[0] ?? '')) continue
      const fecha = c[0] as string
      if (fecha > hoy) continue
      const agente = c[4] ?? ''
      const modelo = c[5] ?? ''
      const coste = numero(c[10]) ?? 0
      const limite = numero(c[11])
      if (fecha >= desdeDia) sumar(dias, fecha, etiquetaDia(fecha), agente, modelo, coste, limite)
      const sem = lunes(fecha)
      if (sem >= desdeSemana) {
        sumar(semanas, sem, `sem. ${sem.slice(8, 10)}/${sem.slice(5, 7)}`, agente, modelo, coste, limite)
      }
    }
  }

  const ordenar = (m: Map<string, PeriodoConsumo>) =>
    [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([, v]) => v)

  return { dias: ordenar(dias), semanas: ordenar(semanas) }
}

/** "1,23 $"; lo que no llega a un céntimo, "<0,01 $". */
export function dinero(n: number): string {
  if (n > 0 && n < 0.005) return '<0,01 $'

  return `${n.toFixed(2).replace('.', ',')} $`
}
