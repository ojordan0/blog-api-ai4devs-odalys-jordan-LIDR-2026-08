import Post from '#models/post'
import Comentario from '#models/comentario'
import { aPostDetalle, aPostResumen } from '#transformers/post_transformer'
import type { PostDetalleDto, PostResumenDto, VecinoDto } from '#transformers/post_transformer'

/**
 * «Corriente» se escribe entero en espanol, asi que hoy el idioma es el mismo para todos
 * los posts. Vive aqui, en un solo sitio, y no repartido por el codigo: el dia que la
 * tabla `posts` tenga columna propia, esta constante se cambia por `post.idioma` y ya.
 */
const IDIOMA_DEL_BLOG = 'es'

/** Quita las tildes de un texto en JavaScript (para el patron de busqueda). */
function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/**
 * El mismo trabajo, pero dentro de SQLite, que no trae una funcion `unaccent` como
 * PostgreSQL. Se aplica sobre la columna para que «tipografia» encuentre «Tipografía».
 */
function sinTildesEnSql(columna: string): string {
  const reemplazos: [string, string][] = [
    ['á', 'a'],
    ['é', 'e'],
    ['í', 'i'],
    ['ó', 'o'],
    ['ú', 'u'],
    ['ü', 'u'],
    ['ñ', 'n'],
    // `lower()` de SQLite solo baja el ASCII: una «Á» inicial llega aqui sin convertir.
    ['Á', 'a'],
    ['É', 'e'],
    ['Í', 'i'],
    ['Ó', 'o'],
    ['Ú', 'u'],
    ['Ñ', 'n'],
  ]
  return reemplazos.reduce(
    (expresion, [con, sin]) => `replace(${expresion}, '${con}', '${sin}')`,
    `lower(${columna})`
  )
}

export type FiltrosListado = {
  pagina: number
  porPagina: number
  categoria?: string
  etiqueta?: string
  autor?: number
  q?: string
}

export type ListadoPaginado = {
  datos: PostResumenDto[]
  meta: { pagina: number; por_pagina: number; total: number; paginas: number }
}

/**
 * Toda la logica de lectura del blog. Los controladores no consultan la base de datos:
 * traducen HTTP a llamadas de este servicio.
 */
export default class PostService {
  /**
   * Regla 1: un borrador no aparece NUNCA. Esta consulta base es el unico sitio
   * donde se decide que es publico, y todo lo demas parte de ella.
   */
  private publicados() {
    return Post.query()
      .where('estado', 'publicado')
      .whereNotNull('publicado_en')
      .preload('autor')
      .preload('categoria')
      .preload('etiquetas')
      // Regla 5: el recuento cuenta solo los comentarios aprobados.
      .withCount('comentarios', (consulta) => consulta.where('estado', 'aprobado'))
  }

  private recuentoDeComentarios(post: Post): number {
    return Number(post.$extras.comentarios_count ?? 0)
  }

  async listar(filtros: FiltrosListado): Promise<ListadoPaginado> {
    const consulta = this.publicados().orderBy('publicado_en', 'desc')

    if (filtros.categoria) {
      consulta.whereHas('categoria', (sub) => sub.where('slug', filtros.categoria!))
    }

    if (filtros.etiqueta) {
      consulta.whereHas('etiquetas', (sub) => sub.where('etiquetas.slug', filtros.etiqueta!))
    }

    if (filtros.autor) {
      consulta.where('autor_id', filtros.autor)
    }

    if (filtros.q) {
      // Busqueda por palabras, insensible a mayusculas y a tildes. Es LITERAL: encuentra
      // lo que contiene esas letras. Para encontrar por SIGNIFICADO esta blog-ai (/buscar),
      // que es justo el trabajo que esta consulta no sabe hacer.
      const patron = `%${sinTildes(filtros.q.toLowerCase())}%`
      consulta.where((sub) => {
        sub
          .whereRaw(`${sinTildesEnSql('titulo')} like ?`, [patron])
          .orWhereRaw(`${sinTildesEnSql('resumen')} like ?`, [patron])
          .orWhereRaw(`${sinTildesEnSql('cuerpo')} like ?`, [patron])
      })
    }

    const pagina = await consulta.paginate(filtros.pagina, filtros.porPagina)

    return {
      datos: pagina.all().map((post) => aPostResumen(post, this.recuentoDeComentarios(post))),
      meta: {
        pagina: pagina.currentPage,
        por_pagina: pagina.perPage,
        total: pagina.total,
        paginas: pagina.lastPage,
      },
    }
  }

  async recientes(limite: number): Promise<PostResumenDto[]> {
    const posts = await this.publicados().orderBy('publicado_en', 'desc').limit(limite)
    return posts.map((post) => aPostResumen(post, this.recuentoDeComentarios(post)))
  }

  /** Devuelve `null` si el slug no existe o si el post es un borrador (regla 1). */
  async detalle(slug: string): Promise<PostDetalleDto | null> {
    const post = await this.publicados().where('slug', slug).first()
    if (!post) {
      return null
    }

    // Regla 2: un comentario pendiente no se muestra en el detalle.
    const comentarios = await Comentario.query()
      .where('post_id', post.id)
      .where('estado', 'aprobado')
      .orderBy('creado_en', 'asc')

    return aPostDetalle(post, comentarios, await this.vecinos(post))
  }

  /**
   * «Anterior» es el publicado inmediatamente antes en el tiempo, y «siguiente» el
   * inmediatamente despues. Los borradores no cuentan como vecinos.
   */
  private async vecinos(post: Post): Promise<{ anterior: VecinoDto; siguiente: VecinoDto }> {
    // SQLite guarda la fecha como 'YYYY-MM-DD HH:mm:ss'. Hay que comparar con ESE formato:
    // un ISO con offset se compara como texto y el propio post se cuela como vecino.
    const marca = post.publicadoEn!.toUTC().toFormat('yyyy-MM-dd HH:mm:ss')

    const anterior = await Post.query()
      .where('estado', 'publicado')
      .whereNot('id', post.id)
      .where('publicado_en', '<', marca)
      .orderBy('publicado_en', 'desc')
      .first()

    const siguiente = await Post.query()
      .where('estado', 'publicado')
      .whereNot('id', post.id)
      .where('publicado_en', '>', marca)
      .orderBy('publicado_en', 'asc')
      .first()

    return {
      anterior: anterior ? { titulo: anterior.titulo, slug: anterior.slug } : null,
      siguiente: siguiente ? { titulo: siguiente.titulo, slug: siguiente.slug } : null,
    }
  }

  /**
   * Relacionados por categoria y etiquetas compartidas.
   * Regla 4: nunca incluyen el propio post, y salen como mucho `limite`.
   */
  async relacionados(slug: string, limite: number): Promise<PostResumenDto[] | null> {
    const post = await this.publicados().where('slug', slug).first()
    if (!post) {
      return null
    }

    const idsDeEtiquetas = post.etiquetas.map((etiqueta) => etiqueta.id)

    const candidatos = await this.publicados()
      .whereNot('id', post.id)
      .where((sub) => {
        sub.where('categoria_id', post.categoriaId)
        if (idsDeEtiquetas.length > 0) {
          sub.orWhereHas('etiquetas', (etiquetas) =>
            etiquetas.whereIn('etiquetas.id', idsDeEtiquetas)
          )
        }
      })

    const puntuados = candidatos.map((candidato) => {
      const compartidas = candidato.etiquetas.filter((etiqueta) =>
        idsDeEtiquetas.includes(etiqueta.id)
      ).length
      const mismaCategoria = candidato.categoriaId === post.categoriaId ? 1 : 0
      return { candidato, afinidad: compartidas + mismaCategoria * 2 }
    })

    return puntuados
      .sort((a, b) => {
        if (b.afinidad !== a.afinidad) {
          return b.afinidad - a.afinidad
        }
        return (
          (b.candidato.publicadoEn?.toMillis() ?? 0) - (a.candidato.publicadoEn?.toMillis() ?? 0)
        )
      })
      .slice(0, limite)
      .map(({ candidato }) => aPostResumen(candidato, this.recuentoDeComentarios(candidato)))
  }

  /**
   * Lo que se le manda a blog-ai para indexar. Sale de la MISMA consulta base que el
   * resto del servicio, asi que un borrador no puede colarse en el indice semantico.
   */
  async paraIndexar() {
    const posts = await this.publicados().orderBy('publicado_en', 'desc')
    return posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      titulo: post.titulo,
      resumen: post.resumen,
      cuerpo: post.cuerpo,
      estado: post.estado,
      idioma: IDIOMA_DEL_BLOG,
      categoria: post.categoria.nombre,
      etiquetas: post.etiquetas.map((etiqueta) => etiqueta.nombre),
      publicado_en: post.publicadoEn?.toISO() ?? null,
    }))
  }

  /** Usado por /buscar para devolver la tarjeta completa de cada resultado semantico. */
  async porSlugs(slugs: string[]): Promise<Map<string, PostResumenDto>> {
    if (slugs.length === 0) {
      return new Map()
    }
    const posts = await this.publicados().whereIn('slug', slugs)
    return new Map(
      posts.map((post) => [post.slug, aPostResumen(post, this.recuentoDeComentarios(post))])
    )
  }
}
