import env from '#start/env'
import ContratoService from '#services/contrato_service'
import { ContratoIncumplido, ServicioIaCaido } from '#exceptions/errores_de_integracion'

export type PostParaIndexar = {
  id: number
  slug: string
  titulo: string
  resumen: string
  cuerpo: string
  estado: string
  idioma: string
  categoria?: string
  etiquetas?: string[]
  publicado_en?: string | null
}

export type ResultadoSemantico = {
  post_id: number
  slug: string
  titulo: string
  resumen: string
  puntuacion: number
}

export type RespuestaBuscar = { consulta: string; resultados: ResultadoSemantico[] }
export type FuenteCitada = {
  post_id: number
  slug: string
  titulo: string
  puntuacion: number
  /** Idioma del post citado. Lo informa blog-ai, que lo recibio en /indexar. */
  idioma: string
}
export type RespuestaPreguntar = {
  consulta: string
  respuesta: string
  fuentes: FuenteCitada[]
  modelo: string
}
export type RespuestaIndexar = {
  indexados: number
  omitidos: number
  motivos_omision: { slug: string; motivo: string }[]
}

/**
 * Cliente del OTRO repositorio. Es el unico punto de este servicio que hace red,
 * y el unico que sabe que blog-ai existe.
 *
 * Cada respuesta pasa por el contrato fijado antes de devolverse (`CONTRATO_ESTRICTO`).
 */
export default class BlogAiService {
  constructor(private contrato: ContratoService = new ContratoService()) {}

  private get base() {
    return env.get('BLOG_AI_URL')
  }

  private get estricto() {
    return env.get('CONTRATO_ESTRICTO', true) !== false
  }

  private async pedir<T>(ruta: string, cuerpo: unknown, esquema: string): Promise<T> {
    let respuesta: Response
    try {
      respuesta = await fetch(`${this.base}${ruta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(env.get('BLOG_AI_TIMEOUT_MS', 60_000)),
      })
    } catch (error) {
      throw new ServicioIaCaido(
        `blog-ai no responde en ${this.base} (${(error as Error).message})`
      )
    }

    if (!respuesta.ok) {
      const texto = await respuesta.text()
      throw new ServicioIaCaido(`blog-ai devolvio ${respuesta.status}: ${texto.slice(0, 300)}`)
    }

    const datos = (await respuesta.json()) as T

    // La comprobacion que convierte un fallo silencioso en un fallo con nombre.
    const problemas = await this.contrato.validarContra(esquema, datos)
    if (problemas.length > 0 && this.estricto) {
      throw new ContratoIncumplido(problemas, esquema)
    }

    return datos
  }

  async indexar(posts: PostParaIndexar[]): Promise<RespuestaIndexar> {
    return this.pedir<RespuestaIndexar>('/indexar', { posts }, 'RespuestaIndexar')
  }

  async buscar(consulta: string, limite: number): Promise<RespuestaBuscar> {
    return this.pedir<RespuestaBuscar>('/buscar', { consulta, limite }, 'RespuestaBuscar')
  }

  async preguntar(consulta: string, limite: number): Promise<RespuestaPreguntar> {
    return this.pedir<RespuestaPreguntar>('/preguntar', { consulta, limite }, 'RespuestaPreguntar')
  }

  async salud(): Promise<Record<string, unknown>> {
    try {
      const respuesta = await fetch(`${this.base}/salud`, { signal: AbortSignal.timeout(5_000) })
      if (!respuesta.ok) {
        return { alcanzable: false, detalle: `respondio ${respuesta.status}` }
      }
      const cuerpo = (await respuesta.json()) as Record<string, unknown>
      return { alcanzable: true, ...cuerpo }
    } catch (error) {
      return { alcanzable: false, detalle: (error as Error).message }
    }
  }
}
