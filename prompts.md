# Prompts

Aquí van **todos los prompts que lanzaste** para hacer el ejercicio, en el orden en que los
lanzaste, con el modelo y la herramienta de cada uno.

Esto no es papeleo. Lo que se revisa es **cómo pediste las cosas**, no solo lo que salió: un
resultado flojo con un prompt bueno y un resultado flojo con un prompt vago necesitan feedback
distinto, y sin este archivo no se distinguen.

## Cómo rellenarlo

- Un apartado `## Prompt N` por cada prompt.
- **Pega el prompt tal cual lo lanzaste**, dentro del bloque de código, aunque ocupe diez líneas
  y aunque tenga faltas. No lo reescribas para que quede bien: el que arreglaste mentalmente
  después no es el que lanzaste.
- Incluye también los que **no funcionaron**. Suelen ser los más útiles de leer.
- `Modelo` y `Herramienta` en todos. Si cambiaste de una a otra a mitad, se nota aquí.

Borra el ejemplo de abajo cuando escribas el primero.

---

## Prompt 1

**Modelo:** Opus 5 (1M context) with high effort
**Herramienta:** Claude Code

```
Aplica la  siguiente regla de proceso a este repositorio:
El contrato viaja en el mismo commit. "Todo commit que añada, renombre o borre un campo de la frontera entre servicios modifica también, en ese mismo commit, el archivo de contrato versionado de la frontera en el repositorio. Si la frontera no tiene contrato, ignora la regla.” 
Implementa esta regla utilizando un hook.
```

**Qué salió:** Me indico que el repo blog-api tiene una frontera sin contrato versionado, y pregunto que hacer en ese caso. Tambien pregunto si queria un Hook de Claude Code o un Hook de git pre-commit.

## Prompt 2

**Modelo:** Opus 5 (1M context) with high effort
**Herramienta:** Claude Code

```
Aplica la siguiente regla de proceso a este repositorio:
El contrato viaja en el mismo commit. "Todo commit que añada, renombre o borre un campo de la frontera entre servicios modifica también, en ese mismo commit, el archivo de contrato versionado de la frontera en el repositorio. Si la frontera no tiene contrato, ignora la regla.” 
Implementa esta regla utilizando un hook de git pre-commit.
```

**Qué salió:** Lo que monto explicado: 
- scripts/contrato_en_el_commit.mjs  La comprobación. Node pelado, sin dependencias. Sale 0 o 1.
-  .githooks/pre-commit  El disparador. Se ejecuta en git, antes de crear el commit.

Cómo decide. No mira si el archivo se tocó — eso daría falsos positivos con cada comentario. Extrae el conjunto de campos que declaran los export type de app/services/blog_ai_service.ts en dos versiones: HEAD:archivo y :archivo (el índice, o sea lo que va en este commit). Si los conjuntos difieren y contracts/blog-ai.openapi.json no está en el índice, aborta y nombra el campo que se movió.


## Prompt 3

**Modelo:** Opus 5 (1M context) with high effort
**Herramienta:** Claude Code

```
Comprueba la regla aplicando los siguientes casos de prueba, y muestrame los resultados de cada uno.
- Cambio solo de comentario en la frontera. (comprueba Falso Positivo)
- Campo añadido, sin contrato actualizado
- El mismo campo, con el contrato en el índice actualizados
- Campo borrado, sin contrato actualizado
```

**Qué salió:** 
     Caso                                      │                 Resultado                 │
├──────────────────────────────────────────────┼───────────────────────────────────────────┤
│ Cambio solo de comentario en la frontera     │ pasa (0) — sin falso positivo             │
├──────────────────────────────────────────────┼───────────────────────────────────────────┤
│ Campo añadido, sin contrato                  │ bloquea (1) — + FuenteCitada.idioma       │
├──────────────────────────────────────────────┼───────────────────────────────────────────┤
│ El mismo campo, con el contrato en el índice │ pasa (0)                                  │
├──────────────────────────────────────────────┼───────────────────────────────────────────┤
│ Campo borrado, sin contrato                  │ bloquea (1) — - RespuestaPreguntar.modelo │



## Prompt 4

**Modelo:** Opus 5 (1M context) with high effort
**Herramienta:** Claude Code

```
Añade a las fuentes que devuelve /preguntar un campo nuevo idioma, con el idioma del post. Que blog-api lo reciba y lo pase a su cliente.
```

**Qué salió:** El Agente hizo los cambios necesarios para completar el encargo, e intentó commitearlos. El hook de pre-commit paró el commit. Por tanto la regla se cumplió.
El primer git commit fue abortado:
  El contrato no viaja en este commit.
  Frontera con blog-ai. Este commit mueve campos:
    app/services/blog_ai_service.ts
      + PostParaIndexar.idioma
      + FuenteCitada.idioma
  y deja fuera contracts/blog-ai.openapi.json



  ## Prompt 5

**Modelo:** Opus 5 (1M context) with high effort
**Herramienta:** Claude Code

```
No hay nada commiteado aun. Deshace el encargo para poder repetirlo en el otro repo blog-ai. 
```

**Qué salió:** El Agente corrio los git commands que revirtieron los cambios en los ficheros modificados, y confirmo el resultado: Deshecho. Compruebo que el mecanismo sigue en pie y que los tipos volvieron a su forma original: blog-api: en 3028712, con solo el mecanismo y la entrega sin commitear. El hook sigue activo (core.hooksPath → .githooks) y armado.

  ## Prompt 6 - desde el repo blog-ai

**Modelo:** Opus 5 (1M context) with high effort
**Herramienta:** Claude Code

```
 Añade a las fuentes que devuelve /preguntar un campo nuevo idioma, con el idioma del post. Que blog-api lo reciba y lo pase a su cliente. Cuando termines, muestrame los fiheros que modificaste. No hagas commit todavia.
```

**Qué salió:** Listo los 4 ficheros modificados. El fichero contrato/openapi.json no esta entre ellos. Intente crear el commit y fue posible hacerlo sin que nada lo bloqueara. 