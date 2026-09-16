# El contrato con `blog-ai`

`blog-ai.openapi.json` es una **copia fijada** del documento OpenAPI que publica `blog-ai`
(su original vive en `blog-ai/contrato/openapi.json`, generado desde el código con
`python scripts/generar_openapi.py`).

Está aquí, versionado, por un motivo concreto: **el contrato entre dos repositorios no
puede vivir solo en la cabeza de quien escribió el cliente**. Si lo único que hay es un
`fetch()` con nombres de campo escritos a mano, un cambio al otro lado no rompe nada
visible: llega un `undefined` y viaja hasta la pantalla.

## Cómo se usa esta copia

1. **En caliente**, `ContratoService.validarContra()` comprueba cada respuesta de `blog-ai`
   contra el esquema de este archivo. Si falta un campo obligatorio o cambia de tipo,
   `blog-api` devuelve **502 `E_CONTRATO_INCUMPLIDO`** con la lista de problemas, en vez de
   propagar el hueco. Con `CONTRATO_ESTRICTO=false` la validación se apaga: la respuesta pasa
   tal cual, con el hueco dentro y sin que nada lo señale.

2. **Bajo demanda**, `node ace contrato:verificar` (o `GET /contrato`) descarga el OpenAPI
   vivo de `blog-ai` y lo compara con esta copia: operaciones que aparecen o desaparecen,
   esquemas que ya no existen, campos renombrados y cambios en la lista de obligatorios.
   Devuelve código de salida 1 si hay deriva, así que puede atarse a la integración continua.

3. **En cada commit**, el hook `.githooks/pre-commit` comprueba la regla *«el contrato viaja
   en el mismo commit»*: si el commit mueve un campo de `app/services/blog_ai_service.ts` y no
   lleva este archivo dentro, se aborta. La comprobación está en
   `scripts/contrato_en_el_commit.mjs` y se instala con `make hooks`. Es lo que impide que esta
   copia se quede vieja **entre** dos verificaciones: los puntos 1 y 2 solo pueden avisar
   cuando ya diverge.

## Cómo se actualiza

Cuando `blog-ai` cambia su API **a propósito**:

```bash
cd ../blog-ai && python scripts/generar_openapi.py     # regenera el original
cp ../blog-ai/contrato/openapi.json contracts/blog-ai.openapi.json
node ace contrato:verificar                            # tiene que decir «coincide»
```

Ese `cp` es deliberadamente manual y deliberadamente visible en el diff: **adoptar un
contrato nuevo es una decisión, no un efecto secundario de `npm install`.**
