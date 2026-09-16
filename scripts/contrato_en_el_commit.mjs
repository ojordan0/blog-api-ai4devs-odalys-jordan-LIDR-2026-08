#!/usr/bin/env node
/**
 * La regla: «el contrato viaja en el mismo commit».
 *
 * Todo commit que anada, renombre o borre un campo de una frontera entre servicios
 * tiene que modificar tambien, en ESE MISMO commit, el contrato versionado de esa
 * frontera. Si la frontera no tiene contrato versionado, la regla no se le aplica.
 *
 * Este archivo es la COMPROBACION. El disparador es `.githooks/pre-commit`, que lo
 * llama antes de crear el commit. Se puede ejecutar tambien a mano:
 *
 *     node scripts/contrato_en_el_commit.mjs     # mira lo que hay en el indice
 *
 * Sale 0 si la regla se cumple y 1 si no, asi que sirve igual para un hook, para
 * la integracion continua o para llamarlo desde otro sitio.
 */

import { execFileSync } from 'node:child_process'

/**
 * Las fronteras de este repositorio: que archivos DECLARAN la forma de lo que cruza,
 * y con que contrato versionado tienen que viajar.
 *
 * La segunda entrada, con `contrato: null`, es la ultima clausula de la regla puesta
 * por escrito: la frontera con blog-web no tiene contrato versionado, asi que la regla
 * no la vigila. Esta aqui, y no omitida, para que se lea como una decision y no como
 * un olvido. El dia que esa frontera tenga contrato, se rellena esta linea y empieza
 * a vigilarse sin tocar nada mas.
 */
const FRONTERAS = [
  {
    nombre: 'blog-ai',
    declaran: ['app/services/blog_ai_service.ts'],
    contrato: 'contracts/blog-ai.openapi.json',
  },
  {
    nombre: 'blog-web',
    declaran: [
      'app/transformers/post_transformer.ts',
      'app/transformers/autor_transformer.ts',
      'app/transformers/comentario_transformer.ts',
    ],
    contrato: null,
  },
]

function git(...argumentos) {
  return execFileSync('git', argumentos, { encoding: 'utf-8' })
}

/** El contenido de un archivo en una version de git, o '' si alli no existe. */
function contenido(referencia) {
  try {
    return git('show', referencia)
  } catch {
    // No existe en esa version: el archivo se acaba de crear, o se acaba de borrar.
    return ''
  }
}

function hayHead() {
  try {
    git('rev-parse', '--verify', 'HEAD')
    return true
  } catch {
    return false
  }
}

/** Los comentarios pueden llevar dos puntos; fuera, para que no parezcan campos. */
function sinComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/** El bloque `{ ... }` que empieza en `abre`, con las llaves equilibradas. */
function bloqueBalanceado(texto, abre) {
  let profundidad = 0
  for (let i = abre; i < texto.length; i += 1) {
    if (texto[i] === '{') profundidad += 1
    else if (texto[i] === '}') {
      profundidad -= 1
      if (profundidad === 0) return texto.slice(abre + 1, i)
    }
  }
  return null
}

/** Se queda con lo que hay al nivel de arriba: un campo anidado no es un campo de aqui. */
function soloNivelSuperior(bloque) {
  let salida = ''
  let profundidad = 0
  for (const caracter of bloque) {
    if (caracter === '{' || caracter === '[' || caracter === '(' || caracter === '<') {
      profundidad += 1
    } else if (caracter === '}' || caracter === ']' || caracter === ')' || caracter === '>') {
      profundidad -= 1
    } else if (profundidad === 0) {
      salida += caracter
    }
  }
  return salida
}

/**
 * Los campos que declara un archivo, como un conjunto de «Tipo.campo».
 *
 * Se miran solo los `export type`, que es donde este repositorio escribe la forma de
 * lo que cruza la frontera. Lo que pase dentro de un metodo no es un campo del contrato.
 */
function camposDeclarados(texto) {
  const limpio = sinComentarios(texto)
  const campos = new Set()
  const declaracion = /export\s+type\s+([A-Za-z_]\w*)\s*=/g

  let encontrado = declaracion.exec(limpio)
  while (encontrado !== null) {
    const tipo = encontrado[1]
    const desde = declaracion.lastIndex

    // Hasta donde llega este tipo: la siguiente declaracion, o el final del archivo.
    const siguiente = limpio.indexOf('export type', desde)
    const limite = siguiente === -1 ? limpio.length : siguiente

    // La primera llave que caiga dentro abre el cuerpo. Vale tambien para las
    // intersecciones (`A & { ... }`): lo que importa son los campos que anaden.
    const abre = limpio.indexOf('{', desde)
    if (abre !== -1 && abre < limite) {
      const cuerpo = bloqueBalanceado(limpio, abre)
      if (cuerpo !== null) {
        const plano = soloNivelSuperior(cuerpo)
        const campo = /(^|\n|;|,)\s*([A-Za-z_]\w*)\s*\??\s*:/g
        let nombre = campo.exec(plano)
        while (nombre !== null) {
          campos.add(`${tipo}.${nombre[2]}`)
          nombre = campo.exec(plano)
        }
      }
    }

    encontrado = declaracion.exec(limpio)
  }

  return campos
}

function diferencia(antes, ahora) {
  const anadidos = [...ahora].filter((campo) => !antes.has(campo))
  const borrados = [...antes].filter((campo) => !ahora.has(campo))
  return { anadidos, borrados }
}

function main() {
  const enElCommit = new Set(
    git('diff', '--cached', '--name-only', '--diff-filter=ACMRD')
      .split('\n')
      .filter(Boolean)
  )

  if (enElCommit.size === 0) {
    return 0
  }

  const conHead = hayHead()
  const infracciones = []

  for (const frontera of FRONTERAS) {
    // La clausula final de la regla: sin contrato versionado, no hay nada que exigir.
    if (frontera.contrato === null) {
      continue
    }

    const contratoEnElCommit = enElCommit.has(frontera.contrato)
    const cambios = []

    for (const archivo of frontera.declaran) {
      if (!enElCommit.has(archivo)) {
        continue
      }

      const antes = conHead ? camposDeclarados(contenido(`HEAD:${archivo}`)) : new Set()
      const ahora = camposDeclarados(contenido(`:${archivo}`))
      const { anadidos, borrados } = diferencia(antes, ahora)

      if (anadidos.length > 0 || borrados.length > 0) {
        cambios.push({ archivo, anadidos, borrados })
      }
    }

    // Solo es infraccion si cambian campos Y el contrato se queda fuera del commit.
    // Tocar un comentario o reordenar el archivo no mueve ningun campo: no dispara.
    if (cambios.length > 0 && !contratoEnElCommit) {
      infracciones.push({ frontera, cambios })
    }
  }

  if (infracciones.length === 0) {
    return 0
  }

  console.error('')
  console.error('  El contrato no viaja en este commit.')
  console.error('')

  for (const { frontera, cambios } of infracciones) {
    console.error(`  Frontera con ${frontera.nombre}. Este commit mueve campos:`)
    for (const { archivo, anadidos, borrados } of cambios) {
      console.error(`    ${archivo}`)
      for (const campo of anadidos) console.error(`      + ${campo}`)
      for (const campo of borrados) console.error(`      - ${campo}`)
    }
    console.error('')
    console.error(`  y deja fuera ${frontera.contrato}.`)
    console.error('')
    console.error('  Actualiza el contrato y anadelo AL MISMO commit:')
    console.error('')
    console.error('    cd ../blog-ai && python scripts/generar_openapi.py')
    console.error(`    cp ../blog-ai/contrato/openapi.json ${frontera.contrato}`)
    console.error(`    git add ${frontera.contrato}`)
    console.error('')
  }

  console.error('  Por que: un campo que cambia de un lado y no del otro no rompe nada')
  console.error('  visible. Llega como undefined y viaja hasta la pantalla.')
  console.error('')

  return 1
}

process.exit(main())
