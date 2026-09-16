# blog-api

API del blog **«Corriente»**. Es el **dueño del contenido**: posts, autores, categorías,
etiquetas y comentarios viven aquí, en SQLite, y ningún otro repositorio toca esa base de datos.

Stack: **AdonisJS 6 + Lucid + SQLite**. Puerto **3402**.

Este es uno de los tres repositorios sobre los que trabajas en el Módulo 7, en la lección **«Ejercicio Blog Polirepo»**. Léelo entero antes
de empezar: además de cómo levantarlo, aquí está **el ejercicio y cómo se entrega**.

## El sistema son tres repositorios

El blog «Corriente» no cabe en un árbol de carpetas. Son tres repositorios git independientes,
cada uno con su lenguaje, su historial y su ciclo de vida, que solo se hablan por HTTP:

```
blog-web  :5402  ──HTTP──▶  blog-api  :3402  ──HTTP──▶  blog-ai  :8402
 (React)                     (este repo)                 (búsqueda semántica y RAG)
```

En disco viven como **carpetas hermanas** dentro de una carpeta común:

```
blog/
├── blog-api/     ← este repositorio
├── blog-web/
└── blog-ai/
```

> 🚨 **El nombre de la carpeta no coincide con el del repositorio, y sí importa.**
> Los repositorios se llaman `blog-api-ai4devs`, `blog-web-ai4devs` y `blog-ai-ai4devs`, pero
> las carpetas en tu disco tienen que llamarse exactamente **`blog-api`**, **`blog-web`** y
> **`blog-ai`**. Todo lo que viene después lo da por hecho: las rutas relativas entre los tres
> y los comandos de este README. Por eso **el `git clone` lleva siempre la carpeta destino
> escrita al final**. Si la omites, git te crea `blog-api-ai4devs` y a partir de ahí no encaja
> nada.

### Forkea los tres, y monta este

Forkea los tres repositorios con el botón **Fork** de cada uno. Hace falta: sobre un clon
directo no tienes permiso de escritura, y aquí vas a crear una rama y commitear.

> 🚨 **En el formulario del fork, DESMARCA la casilla que dice copiar solo la rama por
> defecto.** Viene marcada, y si la dejas así tu fork se lleva únicamente `main`. Da igual
> cómo la dejaras: las dos líneas de `upstream` de abajo traen la rama de partida del
> repositorio del curso, así que funcionan en los dos casos.

**Los tres se montan de uno en uno, y `blog-ai` va primero** porque los otros dos dependen de
él. Cada `make up` se queda ocupando su terminal, así que abre una nueva para cada
repositorio. Desde la carpeta que los va a contener (`mkdir blog && cd blog`), este es el
tuyo:

```bash
git clone git@github.com:<tu-usuario>/blog-api-ai4devs.git blog-api
cd blog-api
git remote add upstream git@github.com:LIDR-academy/blog-api-ai4devs.git
git fetch upstream
git checkout -b s7/start upstream/s7/start
```

`blog-ai` y `blog-web` se montan igual, cambiando el nombre en las cinco líneas. El orden
completo y las comprobaciones de cada uno están más abajo, en *Levantar el sistema entero*.

> 📌 Si te sale `Permission denied (publickey)`, es SSH y no el fork. La guía oficial está en
> `docs.github.com/es/authentication/connecting-to-github-with-ssh`.

## Cómo se levanta este repositorio

```bash
make setup    # solo la primera vez: instala, crea el .env y prepara la base de datos
make up       # arranca la API en http://localhost:3402
```

Antes de tocar nada, `make setup` comprueba que la carpeta se llama `blog-api` y que tu Node
es 20 o superior. Si falta algo, el mensaje dice **qué** falta y **cómo** resolverlo, en vez
de reventar veinte comandos más adelante. Los tres repositorios traen los mismos atajos:
`make check`, `make setup` y `make up`, más `make ayuda` para ver la lista.

<details>
<summary>Qué hace <code>make setup</code> por dentro, si prefieres ir a mano</summary>

```bash
npm ci                        # instala exactamente lo que fija package-lock.json
cp .env.example .env
node ace generate:key         # rellena APP_KEY, que .env.example deja vacía
mkdir -p tmp                  # tmp/ está en el .gitignore, así que no viene en el clon
node ace migration:run
node ace db:seed              # 8 posts publicados + 2 borradores, 3 autores, comentarios
```

Dos detalles que el atajo te ahorra. Sin `mkdir -p tmp`, `node ace migration:run` muere con
*"Cannot open database because the directory does not exist"*, y el error no dice que falte
una carpeta. Y es `npm ci`, no `npm install`: `ci` instala exactamente las versiones fijadas
y **no reescribe** `package-lock.json`, así que el repositorio se queda limpio.
</details>

Comprobación rápida:

```bash
curl -s localhost:3402/salud | jq
curl -s 'localhost:3402/posts?por_pagina=3' | jq '.meta'
```

### Levantar el sistema entero, y en este orden

Cada pieza depende de la anterior, así que el orden no es una preferencia:

1. **Ollama arrancado.** Sus dos modelos los descarga el `make setup` de `blog-ai`, así que
   no tienes que buscarlos.
2. **`blog-ai`** en el **8402**: `make setup` la primera vez, que levanta de paso PostgreSQL
   con pgvector en el **5433** y espera a que acepte conexiones; después `make up`.
3. **`blog-api`** en el **3402**: `make setup` la primera vez, después `make up`.
4. **`blog-web`** en el **5402**: `make setup` la primera vez, después `make up`.

Son tres terminales, una por repositorio, porque cada `make up` se queda ocupando la suya.

Y **después el indexado**, que es el paso que se olvida. Sin él la búsqueda devuelve lista
vacía:

```bash
curl -s -X POST localhost:3402/indexar | jq
```

El `README.md` de `blog-ai` explica su parte con detalle, incluida la versión de Python que
hace falta.

## Rutas

```
GET  /posts                     lista publicados, paginada; ?categoria= ?etiqueta= ?autor= ?q=
GET  /posts/recientes           los N más recientes
GET  /posts/:slug               detalle + autor + categoría + etiquetas + comentarios + vecinos
GET  /posts/:slug/relacionados  por categoría y etiquetas compartidas
GET  /categorias                con recuento de posts publicados
GET  /etiquetas                 con recuento de posts publicados
GET  /autores/:id               autor + sus posts publicados
POST /posts/:slug/comentarios   crea un comentario en estado pendiente

POST /buscar                    delega en blog-ai (búsqueda semántica)
POST /preguntar                 delega en blog-ai (RAG)
POST /indexar                   empuja a blog-ai los posts publicados

GET  /salud                     estado propio + el de blog-ai
GET  /contrato                  comparación de contratos (200 coincide · 409 deriva)
```

## De qué depende de los otros dos

| Repositorio | Relación | Qué pasa si no está |
|---|---|---|
| **blog-web** (5402) | Es su cliente. `blog-api` no sabe que existe. | Nada: la API funciona igual. |
| **blog-ai** (8402) | **Dependencia real.** `POST /buscar`, `POST /preguntar` y `POST /indexar` delegan en él. | Esas tres rutas devuelven **502 `E_BLOG_AI_CAIDO`**. El resto del blog sigue en pie. |

El límite con `blog-ai` no es solo código: es un **contrato versionado** en
`contracts/blog-ai.openapi.json`, una copia fijada del documento OpenAPI que publica `blog-ai`.

```bash
node ace contrato:verificar            # compara la copia fijada con el OpenAPI vivo de blog-ai
curl -s localhost:3402/contrato | jq   # lo mismo, por HTTP
```

[`contracts/LEEME.md`](contracts/LEEME.md) explica cómo se valida, cómo se actualiza y qué
caza y qué no.

### La regla: el contrato viaja en el mismo commit

Que el contrato esté versionado no sirve de nada si se actualiza *después*. La regla que
lo sostiene es una sola, y se lee igual en este repositorio y en `blog-ai`:

> **Todo commit que añada, renombre o borre un campo de la frontera entre servicios
> modifica también, en ese mismo commit, el archivo de contrato versionado de esa
> frontera. Si la frontera no tiene contrato, la regla no se le aplica.**

No la vigila nadie de memoria: la vigila un **hook de git**.

```
.githooks/pre-commit                  el disparador: se ejecuta en git, antes del commit
scripts/contrato_en_el_commit.mjs     la comprobación: sale 0 si se cumple, 1 si no
```

El hook compara los campos que declara `app/services/blog_ai_service.ts` **antes y después**
del commit que estás creando. Si esa lista cambia y `contracts/blog-ai.openapi.json` no está
en el índice, el commit se aborta y el mensaje dice qué campo se movió. Tocar un comentario o
reordenar el archivo no mueve ningún campo, así que no dispara.

```bash
make hooks     # apunta git a .githooks/ (make setup ya lo hace)
```

Hace falta ese paso porque **los hooks no se clonan**: vienen versionados en el repositorio,
pero git no los activa solo. Y `git commit --no-verify` se los salta, que es justo por lo que
esta no es la última línea de defensa, sino la primera.

> 📌 **Dónde se ejecuta, que es la pregunta que importa.** En git, en tu máquina, en el
> momento del commit — no en la sesión de ninguna herramienta. Da igual quién escriba el
> código: el hook corre igual. Lo que **no** cubre es el otro repositorio: cuando el commit
> se hace en `blog-ai`, el `pre-commit` que se ejecuta es el de `blog-ai`.

## Reglas de negocio

Esto es lo que el sistema **debe** cumplir, y lo fijan las pruebas:

1. Un post en `borrador` no aparece en listados, relacionados, recientes ni búsqueda, **ni
   siquiera para su autor**.
2. Un comentario `pendiente` no se muestra en el detalle del post.
3. `slug` es único entre posts.
4. Los relacionados nunca incluyen el propio post, y salen como mucho N.
5. El recuento de comentarios cuenta **solo los aprobados**.
6. La respuesta pública de un post **no expone el correo del autor** ni el de quien comenta.

## Cómo está organizado

```
start/routes.ts        rutas finas, sin lógica
app/controllers/       traducen HTTP: validan, llaman al servicio, eligen el estado
app/services/          toda la lógica; los controladores no consultan la base de datos
app/transformers/      DTOs de salida, campo a campo
app/validators/        VineJS, en la frontera de entrada
app/models/            Lucid
contracts/             el contrato fijado con blog-ai
scripts/               comprobaciones sueltas, sin framework: una regla, un código de salida
.githooks/             los hooks versionados; `make hooks` apunta git aquí
```

**Los transformers no son ceremonia.** Son el sitio donde se cumple la regla 6: el objeto de
salida se construye campo a campo, así que una columna nueva en la tabla no se publica sola. Lo
fija `tests/functional/correos_privados.spec.ts`, que busca los correos de la semilla en el
**cuerpo crudo** de cada respuesta pública, no el nombre de un campo, y por eso sigue fallando
aunque alguien los publique con otra clave.

## Tests

```bash
node ace test          # 21 pruebas: las seis reglas del dominio + el contrato con blog-ai
```

Corren contra `tmp/db.test.sqlite3`, no contra la base de desarrollo.

---

# El ejercicio

**Se hace antes del directo.** Entre veinte minutos y tres cuartos de hora, y conviene ponerle
un reloj. Lo que se entrega son **dos frases**.

## Cómo funciona este módulo

Tres momentos, y conviene que los sepas antes de empezar:

1. **Lo intentas tú**, aquí, sobre estos repositorios. Entregas lo que te salga, con lo que
   tenga.
2. **Lo ves resuelto en el directo.** El mentor trabaja sobre este mismo sistema. Si no te
   salió, ahí ves que se puede y cómo.
3. **Lo replicas después**, con los prompts del mentor, que te llegan por escrito.

Por eso la entrega a medias no es un problema: **el paso 1 no se puntúa por completarlo**. Y
por eso conviene mirar el directo sin teclear, porque lo vas a repetir con calma luego.

> ⚠️ **En el paso 3 no esperes salidas idénticas.** El agente no es determinista: con el mismo
> prompt y el mismo código cambian los nombres, la redacción y hasta cuántas cosas te devuelve.
> Lo que se repite es **la forma**, no el texto.

## Lo que hay que hacer

**1. Los dos repositorios ya los tienes: `blog-api` y `blog-ai`.** Uno consume del otro, y son
dos repositorios de verdad: otro lenguaje, otro historial, otra carpeta. Es la pareja que hace
falta para este ejercicio.

**2. Escribe una sola regla de proceso que deba cumplirse en los dos.** Una, no cinco. Y que
tenga forma comprobable. Si al leerla no puedes decir, mirando el código, si se ha cumplido o
no, todavía no está lista.

> 💡 **Un ejemplo trabajado, por si te atascas justo aquí. Es un ejemplo, no la respuesta que
> se espera de ti**, y cualquier otra regla comprobable vale igual o mejor.
>
> - **La regla, escrita:** *"toda función nueva lleva justo encima una línea que diga qué
>   devuelve cuando no encuentra nada"*.
> - **Por qué es comprobable:** abres el archivo, buscas lo que se acaba de añadir y miras si
>   esa línea está. Sale sí o no, y no hay nada que interpretar ni que puntuar.
> - **Por qué vale para los dos:** no se apoya en el lenguaje ni en el framework de ninguno, y
>   eso importa aquí, porque `blog-api` es TypeScript y `blog-ai` es Python. La regla se lee
>   igual en los dos; lo que cambia es dónde vas a mirar.
> - **Y por qué es buena para este ejercicio en concreto:** si el agente se la salta, no se
>   rompe nada, no falla ninguna prueba y no se pone nada en rojo. La única forma de saber si
>   se cumplió es ir a mirar a propósito.

**3. Haz que tu agente la cumpla, trabajando desde `blog-api`.** Móntalo como te parezca. Vale
cualquier cosa que se te ocurra, y no hay una respuesta que se espere de ti aquí. Para tener
algo que comprobar necesitas un encargo pequeño que toque los dos repositorios: por ejemplo,
añadir una ruta nueva en `blog-ai` y consumirla desde `blog-api`.

**4. Y ahora la comprobación que importa: repite exactamente lo mismo arrancando la sesión
desde `blog-ai`.** Mismo encargo, misma regla, otro punto de partida. Mira si la regla sigue en
pie.

## Lo que hay que anotar

**Dos frases.** No más:

1. **Qué hiciste** para que la regla se cumpliera.
2. **En qué momento exacto dejó de funcionar, y cómo lo comprobaste.**

La segunda es la que vale. *"Dejó de funcionar"* no es una frase de derrota aquí: es el
resultado del ejercicio. Y *"cómo lo comprobaste"* importa tanto como el qué, porque una de las
cosas que se aprenden en este rato es que **algunas de estas roturas no avisan**, y hay que ir
a mirar a propósito para verlas.

> ⚠️ **Lo que se pide es la nota, no el resultado.** No hace falta que lo dejes funcionando, ni
> que llegues al final, ni que encuentres la solución buena. Si te quedas a medias, anota dónde
> te quedaste y qué viste: eso es material igual de válido, y probablemente más útil.

> 📌 **Esto no tiene una solución que puedas adivinar leyendo**, porque no es un problema de
> sintaxis. Aquí no se falla por no saber teclear algo: se avanza descubriendo el mecanismo, y
> descubrirlo tiene esta pinta precisamente porque el mecanismo está escondido.
>
> Y así sabrás que lo tienes bien resuelto, cuando llegue el momento: la regla se cumple **abras
> la sesión desde el repositorio que abras**, y puedes señalar con el dedo **dónde se ejecuta**
> lo que la hace cumplirse. Si no puedes señalar el sitio, todavía no está resuelto, por muy
> bien que haya salido la última prueba.

> ⚠️ **Si se te va de tres cuartos de hora, para y anota lo que tengas.** El ejercicio no
> mejora por insistir más.

---

# Cómo se entrega

**Es un pull request desde tu fork de este repositorio.** Cinco pasos.

### 1. Ya estás en tu fork

Lo forkeaste arriba, antes de clonar. Si te saltaste ese paso, vuelve a él ahora: sobre un clon
directo no tienes permiso de escritura, y aquí vas a crear una rama y commitear.

```bash
cd blog-api
git remote -v          # tiene que salir tu usuario, no LIDR-academy
```

### 2. Crea tu rama

```bash
git checkout -b frontera-<tus-iniciales>
```

### 3. Escribe las dos frases en `docs/frontera.md`

**La carpeta `docs/` no existe todavía en este repositorio: créala.**

```bash
mkdir -p docs
```

Dentro, `frontera.md` con las dos frases y nada más. No hace falta plantilla ni formato: dos
frases, la segunda con el momento exacto y cómo lo comprobaste.

### 4. Rellena `prompts.md`

Está en la raíz, con la plantilla puesta. **Es obligatorio y es la mitad de lo que se revisa**:
lo que se mira no es solo tu resultado, es cómo lo pediste. Un prompt por bloque, con el modelo
y la herramienta que usaste.

> ⚠️ **Ve guardándolos desde el primero, tal cual los lanzas.** No valen reconstruidos: el
> prompt que arreglas mentalmente diez minutos después no es el que lanzaste, y es justo la
> diferencia que interesa mirar.

### 5. Abre el pull request

**Contra este repositorio, no contra tu fork.** Con tu rama empujada, GitHub te ofrece el botón
arriba; comprueba que la rama base es la de este repositorio antes de crearlo.

```bash
git add docs/frontera.md prompts.md
git commit -m "frontera: dos frases + prompts"
git push -u origin frontera-<tus-iniciales>
```

## El plazo

**Antes del directo.** Lo que llegue a tiempo recibe feedback de tu TA antes de la sesión, que
es el momento en que te sirve. Lo que llegue después **se marca como recibido pero no se
revisa**: el feedback existe para que llegues al directo sabiendo dónde fallaste, y después de
la sesión ya no puede hacer eso.

## Antes de conectarte, comprueba

- [ ] Los tres repositorios están clonados como **carpetas hermanas** llamadas `blog-api`,
      `blog-web` y `blog-ai`.
- [ ] Estás en tu **fork**, en tu rama, y `git push` funciona.
- [ ] `blog-api` levanta y `node ace test` corre.
- [ ] Existe `docs/frontera.md`, con las dos frases.
- [ ] `prompts.md` está relleno, con modelo y herramienta en cada bloque.
- [ ] El pull request está abierto **contra este repositorio**.
