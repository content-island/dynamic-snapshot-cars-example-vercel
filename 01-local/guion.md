# Guion de vídeo · 01-local · Dynamic Snapshot con Redis

> Documento de rodaje. La referencia técnica está en [`README_es.md`](./README_es.md).
>
> **Convenciones:** _Dices_ es texto para narrar (escrito para hablarse, no para
> leerse). _En pantalla_ es lo que se ve. _Ojo_ son notas para ti, no se dicen.

---

## Antes de grabar

Una toma limpia empieza con el escenario limpio:

**Terminal**

```bash
cd 01-local
docker compose up -d
docker compose exec redis redis-cli FLUSHALL     # empezamos con Redis vacío
rm -rf .output .nitro .tanstack
```

- Terminal con fuente grande. Dos pestañas: una para `npm run dev`, otra para los `curl`.
- Editor con `src/` abierto y el árbol de ficheros visible.
- Navegador: pestaña con la app y pestaña con Content Island ya logueado.
- Ten a mano un coche concreto que vayas a editar en la demo final. Decide **ya**
  qué campo vas a cambiar (por ejemplo, el precio de un Audi) para no dudar en cámara.
- `SNAPSHOT_CHECK_INTERVAL_MS=5000` en tu `.env`. Con 5 segundos la demo se ve;
  con 5 minutos, no.

**Ojo:** el token de Content Island aparece en `.env`. Si vas a abrir ese fichero
en cámara, o lo censuras en edición, o abre `.env.example` en su lugar.

---

## Ficha del vídeo

**Duración estimada:** 34–38 min.

| #   | Bloque                             | Aprox. |
| --- | ---------------------------------- | ------ |
| —   | **Intro a cámara** (pieza aparte)  | 1:35   |
| 0   | El gancho en pantalla              | 1 min  |
| 1   | El problema de siempre             | 3 min  |
| 2   | Qué es un Dynamic Snapshot         | 3 min  |
| 3   | Por qué Vercel lo complica         | 5 min  |
| 4   | Por qué Redis                      | 3 min  |
| 5   | Levantar Redis                     | 2 min  |
| 6   | Guardar el snapshot                | 4 min  |
| 7   | Cambiar el cliente a modo snapshot | 2 min  |
| 8   | El endpoint de refresco            | 3 min  |
| 9   | Que cada instancia se entere       | 4 min  |
| 10  | Demo final                         | 3 min  |
| 11  | Cierre                             | 1 min  |

---

## Ficheros que tocamos, en orden

Para tenerlo a mano mientras picas en directo. Cada bloque de código del guion
lleva encima su ruta.

| # | Fichero | Bloque | Qué |
| --- | --- | --- | --- |
| 1 | `docker-compose.yml` | 5 | nuevo |
| 2 | `vite.config.ts` | 6 | **se modifica** · import protection |
| 3 | `src/server/redis.ts` | 6 | nuevo · va **antes**: el siguiente lo importa |
| 4 | `src/server/snapshot-store.ts` | 6 | nuevo |
| 5 | `src/common/api/content-island-client.ts` | 7 | **se modifica** |
| 6 | `src/routes/api.snapshot.refresh.ts` | 8 | nuevo |
| 7 | `src/server/snapshot-manager.ts` | 9 | nuevo |
| 8 | `src/start.ts` | 9 | nuevo |

Los pods (`src/pods/car-list/api/car-list.api.ts` y
`src/pods/car-detail/api/car-detail.api.ts`) **no se tocan**. Ese es el remate
del bloque 7, así que tenlos abiertos para poder enseñarlo.

**Ojo:** el guion enseña fragmentos, no ficheros enteros. Si vas a picar en
directo, ten `README_es.md` abierto en otra pestaña o el fichero final a mano —
`redis.ts` y `snapshot-store.ts` son los dos más largos y no vas a querer
reconstruirlos de memoria en cámara.

---

## Intro a cámara

> Pieza aparte: primer plano, sin pantalla. Va delante de todo. **No la leas
> palabra por palabra** — llévate las ideas y di lo tuyo, que se nota muchísimo.

**Notas de rodaje**

- Los **primeros diez segundos** deciden si se quedan. Entra directo al dolor, sin
  «hola, bienvenidos a un nuevo vídeo».
- Sin pantalla que mire, todo el peso está en ti: sube un punto la energía respecto
  a la narración de después.
- Va bien un corte de plano (o un rótulo) cada 15–20 segundos para que no sea un
  plano fijo de dos minutos.
- Duración objetivo: **1:35** hablando a ritmo normal (~140 palabras por minuto).
  Más abajo tienes medido qué cortar para bajar hasta ~1:20.

---

### El texto

**[0:00]**

> Si trabajas con un CMS, seguro que has tenido que elegir entre dos cosas que no
> te acaban de gustar.
>
> O pides el contenido en cada visita, y le metes una llamada de red a cada página
> que sirves. O generas el sitio estático, y cada vez que alguien corrige una coma
> toca reconstruir y desplegar entero.
>
> Yo he estado en los dos lados. Y los dos escuecen.

_Rótulo: «API en cada visita» / «Rebuild en cada cambio»_

**[0:22]**

> Hoy montamos una tercera opción: servir todo el contenido desde memoria, sin una
> sola llamada de red, y que aun así se actualice cuando publicas. Sin desplegar,
> sin reconstruir nada.
>
> Se llama Dynamic Snapshot: te bajas todo el contenido a un JSON, lo tienes en
> memoria, y lo sustituyes en caliente cuando cambia.

_Rótulo: «Dynamic Snapshot»_

**[0:44]** ← **el giro, la parte que engancha**

> Y aquí viene lo interesante, que es la razón de que esto sea un vídeo y no un
> tuit.
>
> En un servidor normal esto es fácil: cargas el JSON al arrancar y ya está. Pero
> vamos a desplegar en Vercel. Y en Vercel tu código no corre en _un_ servidor:
> corre en un montón de instancias pequeñas que aparecen y desaparecen solas.
> Ninguna sabe de las otras. Y no hay forma de decirles a todas «oye, recargad».
>
> Ahí entra Redis, y ahí se nos va media hora bien empleada.

_Rótulo o animación: varias cajitas apareciendo y desapareciendo_

**[1:18]**

> Necesitas JavaScript y haber tocado React. Nada más: ni Redis, ni Vercel, ni
> Content Island hacen falta de antes.
>
> Repo y enlaces en la descripción. Vamos allá.

**[1:35]** → corta a pantalla.

---

### Si quieres bajar de 1:35

Medido sobre el texto real, hablando a ~140 palabras por minuto:

| Versión                                                    | Palabras | Duración |
| ---------------------------------------------------------- | -------- | -------- |
| Completa                                                   | 237      | ~1:41    |
| Sin los requisitos de **[1:18]**                           | 210      | ~1:30    |
| Sin requisitos y sin la frase «Se llama Dynamic Snapshot…» | 186      | ~1:20    |

Los requisitos son lo primero que sobra: caben en un rótulo o en la descripción.

Lo que **no** debes cortar es el giro de **[0:44]**. Es lo que distingue este vídeo
de los otros veinte que hay sobre snapshots. Si tienes que elegir entre recortar
eso o pasarte a 1:50, pásate.

---

## Bloque 0 · El gancho en pantalla · ~1 min

**En pantalla:** la web de coches ya funcionando. Navegas por el listado, entras
en un detalle. Todo instantáneo.

**Dices:**

> Esta web saca todo su contenido de un CMS. El listado, las fichas, las imágenes,
> los textos: todo. Y sin embargo, cuando navego, no hay ni una sola llamada a la
> API del CMS. Cero.
>
> Y ahora mira esto.

**En pantalla:** cambias un precio en Content Island y le das a publicar. Vuelves
al navegador, recargas. El precio nuevo está ahí.

**Dices:**

> Sin volver a desplegar. Sin reconstruir el sitio. Sin esperar tres minutos a que
> pase un pipeline. He publicado y ya está.
>
> Esto es lo que vamos a montar. Empezamos.

**Ojo:** esta demo la grabas al final, cuando todo funcione, y la pegas aquí en
edición. No intentes hacerla en directo al principio.

**Ojo:** el «qué vamos a hacer y por qué» ya lo has contado a cámara. Aquí solo
enseñas el resultado y arrancas — si lo repites, pierdes gente.

---

## Bloque 1 · El problema de siempre · ~3 min

**En pantalla:** diagrama simple, o simplemente tú hablando. Sin código todavía.

**Dices:**

> Vamos a empezar por el problema, porque si no, la solución no se entiende.
>
> Cuando montas una web con un CMS headless tienes básicamente dos caminos, y los
> dos tienen pega.
>
> El primero es **pedir el contenido en cada petición**. Alguien entra en tu web,
> tu servidor llama a la API del CMS, espera la respuesta, y con eso pinta la
> página. Funciona, es siempre fresco, pero le estás metiendo una llamada de red a
> cada visita. Y esa llamada es lenta comparada con todo lo demás que hace tu
> servidor. Además, si el CMS tiene un mal día, tu web tiene un mal día.
>
> El segundo camino es **generar el sitio estático**. Descargas todo el contenido
> en tiempo de build, generas los HTML, y sirves ficheros. Rapidísimo. Pero ahora
> cada vez que alguien de marketing corrige una coma tienes que reconstruir y
> volver a desplegar el sitio entero. Y si tienes miles de páginas, eso son
> minutos. A veces bastantes minutos.
>
> Y lo que suele pasar en la práctica es que acabas eligiendo el menos malo y
> conviviendo con la pega.

**En pantalla:** la app tal y como está ahora — abres `car-list.api.ts`.

**Dices:**

> Este proyecto de partida está en el primer caso. Es una app de TanStack Start
> que lista coches, y cada vez que pides el listado, esto de aquí llama a la API
> de Content Island.

**`src/pods/car-list/api/car-list.api.ts`** · ya existe, _no lo tocamos_

```ts
export const getCarListApi = createServerFn().handler(
  async (): Promise<Array<CarSummaryApiModel>> => {
    return contentIslandClient.getContentList<CarSummaryApiModel>({
      contentType: "Car",
      includeRelatedContent: true,
      sort: { "fields.brand": "asc" },
    });
  },
);
```

> Quédate con esta función. Es importante por una razón que vas a ver dentro de un
> rato: **no la vamos a tocar**. Ni esta ni la del detalle. Al final del vídeo
> seguirán exactamente igual que ahora, y sin embargo no harán ni una llamada de red.

---

## Bloque 2 · Qué es un Dynamic Snapshot · ~3 min

**En pantalla:** diagrama. CMS → un JSON → memoria del servidor.

**Dices:**

> La idea del Dynamic Snapshot es coger lo mejor de los dos caminos.
>
> Content Island te deja **exportar todo el contenido de tu proyecto a un único
> fichero JSON**. Todo: los contenidos, sus relaciones, el modelo. Eso es el
> snapshot.
>
> Y luego su cliente de JavaScript puede trabajar en dos modos. En modo `api`,
> que es el normal, cada llamada sale a la red. En modo `snapshot`, las mismas
> llamadas se resuelven contra ese JSON, cargado en memoria.
>
> Y cuando digo _las mismas llamadas_, es literal. Mismos métodos, mismos
> parámetros, mismas respuestas. Por eso te decía que no vamos a tocar la función
> de antes: `getContentList` sigue siendo `getContentList`. Lo único que cambia es
> de dónde saca los datos.

**En pantalla:** los dos `createClient` uno al lado del otro.

**`src/common/api/content-island-client.ts`** · antes y después

```ts
// antes
createClient({ accessToken });

// después
createClient({ accessToken, mode: "snapshot", snapshotLoader });
```

**Dices:**

> Esto es lo que va a cambiar en toda la aplicación, a nivel de lógica de datos.
> Una llamada.
>
> Y la parte _dinámica_ del nombre viene de aquí: el snapshot no está clavado en el
> build. Vive en memoria, y se puede sustituir en caliente cuando publicas algo
> nuevo. Sin reconstruir, sin reiniciar.

**Ojo (venta, suave):** aquí es donde toca dejar caer que esta maquinaria —
exportar, validar, sustituir en caliente sin cortar peticiones en vuelo — viene
hecha en el cliente de Content Island. No lo vendas más, con enseñarlo basta.

**Dices:**

> Y ojo a un detalle: sustituir el snapshot mientras hay peticiones en vuelo tiene
> su miga. Validar que el JSON nuevo es correcto, cambiarlo de forma atómica, no
> dejar a medias a nadie. Todo eso ya viene resuelto en el cliente. Nosotros no
> vamos a escribir nada de eso.

---

## Bloque 3 · Por qué Vercel lo complica · ~5 min

**Ojo:** este es **el bloque importante del vídeo**. Es lo que lo diferencia de
cualquier otro tutorial de snapshots. No lo corras.

**En pantalla:** diagrama de un servidor tradicional: una caja, un proceso, una
flecha de "arranca" y una de "vive".

**Dices:**

> Vale, pues si esto es tan bonito, ¿por qué hace falta un vídeo entero?
>
> Porque depende muchísimo de dónde despliegues.
>
> Si despliegas en un servidor de toda la vida —una máquina, un contenedor, un App
> Service— esto es trivial. Tienes un proceso que arranca, carga el snapshot en
> memoria y se queda ahí vivo durante días. Cargas una vez y ya está.

**En pantalla:** cambias el diagrama. Ahora hay varias cajas pequeñas, algunas
apareciendo, algunas desapareciendo, otras en gris.

**Dices:**

> Vercel no funciona así. Y esto es lo que quiero que te lleves del vídeo aunque
> se te olvide todo lo demás.
>
> En Vercel tu código corre en **funciones**. Y una función no es _un_ servidor: es
> un número variable de instancias pequeñas que la plataforma crea y destruye
> según le convenga. Si llega tráfico, crea más. Si deja de llegar, las pausa. Si
> lleva mucho pausada, la destruye y luego crea otra.
>
> ¿Y qué significa eso para nuestra memoria? Que **una variable global no es
> global**. Es de esa instancia y de nadie más.

**En pantalla:** subraya o señala las cajas una a una.

**Dices:**

> Imagínate que tenemos cuatro instancias vivas y publicas un cambio. ¿Cómo les
> avisas? Pues no puedes. No hay ninguna API que diga "todas las instancias,
> recargad". No existe.
>
> Y aunque tuvieras una lista de instancias vivas, hay una que está pausada y no te
> va a contestar, y hay otra que ni siquiera existe todavía: se va a crear dentro de
> media hora, cuando llegue tráfico, y va a arrancar con la memoria vacía.

**Dices, marcando bien:**

> Así que la regla que gobierna todo el diseño de hoy es esta: **la memoria es una
> caché rapidísima, pero no puede ser la fuente de la verdad.**

**Ojo:** haz una pausa aquí. Es la frase del vídeo.

**Dices:**

> Necesitamos un sitio, fuera de las instancias, que diga cuál es el contenido
> vigente ahora mismo. Y necesitamos que cada instancia, por su cuenta y sin que
> nadie la avise, sepa cuándo su copia se ha quedado vieja.

---

## Bloque 4 · Por qué Redis · ~3 min

**En pantalla:** el diagrama, ahora con una caja "Redis" en el centro.

**Dices:**

> Si nunca has usado Redis: piensa en un almacén de clave-valor que vive en
> memoria y al que le hablas por red. Es rapidísimo, y lo típico es usarlo de
> caché. Aquí lo vamos a usar de otra forma: como **el sitio donde vive la versión
> publicada del contenido**.
>
> El reparto queda así. Redis es la fuente de la verdad. La memoria de cada
> instancia es una copia rápida para leer. Y Content Island es de donde sale una
> versión nueva cuando publicas.

**Dices:**

> Y aquí hay una decisión que quiero justificar, porque lo primero que te va a
> venir a la cabeza si conoces Redis es _pues usa Pub/Sub_.
>
> Pub/Sub es el sistema de mensajes de Redis: publicas un aviso y todos los que
> estén suscritos lo reciben. Suena perfecto: publico contenido, mando el aviso, y
> todas las instancias recargan.
>
> El problema está en esa palabra: **los que estén suscritos**. Pub/Sub entrega el
> mensaje a quien esté conectado en ese instante, y ya. La instancia pausada se lo
> pierde. La que se va a crear mañana, ni te cuento. Y lo peor es que no te enteras
> de que se lo ha perdido.

**Dices:**

> Así que le damos la vuelta. En vez de que Redis avise, **cada instancia
> pregunta**. Y pregunta muy barato: en Redis vamos a guardar dos cosas, el
> snapshot y un número de versión. Y lo que preguntamos cada X tiempo es solo la
> versión, que son cuarenta bytes. Si no ha cambiado, no hacemos nada. Si ha
> cambiado, entonces sí, nos bajamos el snapshot entero.
>
> Preguntar sale casi gratis. Descargar sale caro. Y descargar solo pasa cuando de
> verdad ha cambiado algo.

**En pantalla:** el diagrama final completo (el de la sección 2 del README).

---

## Bloque 5 · Levantar Redis · ~3 min

### 5.1 El contenedor

**En pantalla:** creas `docker-compose.yml`.

**Dices:**

> Para desarrollar en local levantamos un Redis con Docker. Nada del otro mundo.

**`docker-compose.yml`** · nuevo, en la raíz de `01-local` · **completo, para pegar**

```yaml
services:
  redis:
    image: redis:8-alpine
    container_name: content-island-redis
    command: redis-server --appendonly yes

    # Bound to the loopback interface only: Redis is not reachable from other
    # machines on the network.
    ports:
      - "127.0.0.1:6379:6379"

    volumes:
      - redis-data:/data

    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  redis-data:
```

**Dices:**

> Dos detalles que no son porque sí. El puerto lo publico solo en `127.0.0.1`, no
> en todas las interfaces, para no dejar un Redis abierto a la red de casa o de la
> oficina. Y el `appendonly` con el volumen hace que lo que guardemos sobreviva a
> reiniciar el contenedor, que mientras desarrollas se agradece.

**Terminal**

```bash
docker compose up -d
docker compose exec redis redis-cli ping
```

**En pantalla:** responde `PONG`.

**Dices:**

> `PONG`. Ya tenemos Redis.

### 5.2 Las dos dependencias

**Terminal**

```bash
npm install redis @vercel/functions
```

**Dices:**

> Y nos hacen falta dos paquetes.
>
> El primero, `redis`, es el cliente oficial de Redis para Node. Ese es evidente.
>
> El segundo tiene más explicación. `@vercel/functions` son utilidades de Vercel
> para código que corre dentro de sus funciones. Nosotros vamos a usar una sola
> cosa de ahí, y ahora te cuento para qué.

**Ojo:** `zlib`, `util` y `crypto` vienen con Node, no hay que instalarlos.

**Ojo (opcional):** si prefieres no meter una dependencia de Vercel en el paso
local, puedes dejar `attachDatabasePool` fuera de `redis.ts` y añadirlo en
`02-deploy`, que es donde de verdad hace algo. En local es un no-op. La explicación
de 6.1 te vale igual, solo cambia dónde la cuentas.

---

## Bloque 6 · Guardar el snapshot · ~7 min

**En pantalla:** creas la carpeta `src/server/` y dentro dos ficheros. Cada uno lo
creas **cuando vas a escribir su contenido**, no antes: nada de cascarones vacíos.

1. `src/server/redis.ts` — la conexión.
2. `src/server/snapshot-store.ts` — guardar y leer. Importa el anterior, así que
   va después y el editor no te pinta nada en rojo.

### 6.0 Que esto no llegue nunca al navegador

**Ojo:** este apartado es corto pero **no te lo saltes**. Es de lo más útil del
vídeo para alguien que venga de front, y no lo sabe casi nadie.

**Dices:**

> Antes de escribir nada, para un momento, porque esta carpeta es especial.
>
> Todo lo que va a haber en `src/server` maneja secretos. El token de Content
> Island. La URL de Redis, que lleva la contraseña dentro. El secreto del endpoint
> de refresco. Nada de eso puede acabar nunca en el navegador.
>
> Y aquí viene lo que quiero que sepas, porque es de TanStack Start y es muy fácil
> pegarse: **en TanStack Start, por defecto, tu código es isomorfo**. O sea, el
> mismo fichero puede acabar ejecutándose en el servidor y en el cliente. No hay
> una separación automática por carpetas como puedas estar acostumbrado en otros
> frameworks.

**En pantalla:** abres `vite.config.ts`.

**Dices:**

> Así que se lo decimos nosotros. TanStack Start trae una cosa que se llama
> *import protection*, y le vamos a poner una regla: nada de `src/server` puede
> entrar en el bundle de cliente.

**`vite.config.ts`** · ya existe · **el cambio, en diff**

```diff
     tailwindcss(),
-    tanstackStart(),
+    tanstackStart({
+      importProtection: {
+        client: {
+          files: ["**/src/server/**"],
+        },
+      },
+    }),
     viteReact(),
```

**Dices:**

> Con esto, si alguien importa por error algo de `src/server` desde un componente,
> **el build falla**. Y te dice exactamente quién importó qué y por dónde llegó.
>
> Y ojo a un matiz que a mí me pilló. TanStack Start ya trae de serie una
> convención: si llamas a un fichero `algo.server.ts`, lo protege solo. Funciona
> perfectamente. Pero solo protege los ficheros que te hayas acordado de renombrar.
>
> Protegiendo la carpeta entera, protegemos también los ficheros que todavía no
> existen. Que es justo donde se cuela esto: dentro de seis meses alguien añade un
> `src/server/config.ts` con una clave, no se acuerda del sufijo, y se filtra.

**Ojo (demo opcional, 30 s, y es la que más impresiona):** créate un
`src/server/probe.ts` con `export const secreto = 'lo-que-sea'`, impórtalo desde
`src/routes/index.tsx` y haz `npm run build`. **Sin** la regla puesta, el build
pasa en verde y el secreto acaba en un `.js` del navegador — lo puedes enseñar
buscándolo en `.output/public/assets/`. **Con** la regla, el build revienta. Ese
contraste vale más que toda la explicación.

**Dices, si haces la demo:**

> Fíjate, sin la regla el build pasa tan contento. Y aquí está mi secreto, en un
> fichero JavaScript que se descarga cualquiera que abra la web. Ponemos la regla,
> volvemos a compilar... y ahora sí protesta.


**Ojo:** `redis.ts` son unas 100 líneas y `snapshot-store.ts` unas 130. Teclearlas
enteras en directo es un peñazo de ver. Lo que funciona: escribe a mano la parte
que estás explicando, y el resto (imports, boilerplate) lo pegas y lo pasas por
encima. El espectador quiere ver **la decisión**, no verte escribir imports.

**Dices:**

> Vamos a guardar el snapshot en Redis. Son dos ficheros, y por el camino te voy
> explicando las decisiones, porque son las que hacen que esto aguante en
> producción.

### 6.1 La conexión · `src/server/redis.ts`

**`src/server/redis.ts`** · nuevo · **completo, para pegar**

```ts
import { attachDatabasePool } from '@vercel/functions'
import { RESP_TYPES, createClient } from 'redis'

type RedisClient = ReturnType<typeof createClient>

/**
 * Managed Redis providers inject the connection string under their own name.
 * Redis Cloud on Vercel sets `REDIS_URL`; the others are accepted so a change of
 * provider is configuration rather than a code edit.
 */
const REDIS_URL_ENV_VARS = ['REDIS_URL', 'REDIS_TLS_URL', 'KV_URL'] as const

let client: RedisClient | undefined
let bufferClient: ReturnType<RedisClient['withTypeMapping']> | undefined
let connectionPromise: Promise<unknown> | undefined

function readRedisUrl(): { url: string; source: string } {
  for (const name of REDIS_URL_ENV_VARS) {
    const url = process.env[name]

    if (url) {
      return { url, source: name }
    }
  }

  throw new Error(
    `No Redis connection string found. Set one of: ${REDIS_URL_ENV_VARS.join(', ')}`,
  )
}

// The client is created on first use, not at module load: a missing connection
// string must fail the request that needs Redis, not the bundle evaluation.
function getClient(): RedisClient {
  if (!client) {
    const { url, source } = readRedisUrl()

    client = createClient({ url })

    // node-redis emits 'error' on every reconnect attempt. Without a listener
    // Node treats it as an unhandled 'error' event and kills the process.
    client.on('error', (error) => {
      console.error('[redis] connection error', error)
    })

    // Keeps the Vercel instance alive long enough to release idle connections
    // before it is suspended. A suspended instance never fires its own timers,
    // so its socket would linger until the server times it out — and Redis
    // Cloud's free tier only allows 30 of them. No-op outside Vercel.
    attachDatabasePool(client)

    // Never log the URL itself: it carries the password.
    console.log(`[redis] using ${source} (tls: ${url.startsWith('rediss://')})`)
  }

  return client
}

/**
 * Same connection, but Blob Strings come back as Buffer instead of string.
 * That is what lets us store the gzipped snapshot as raw bytes, with no Base64
 * round-trip and no UTF-8 corruption.
 */
export function getBufferClient() {
  if (!bufferClient) {
    bufferClient = getClient().withTypeMapping({
      [RESP_TYPES.BLOB_STRING]: Buffer,
    })
  }

  return bufferClient
}

export function getRedis(): RedisClient {
  return getClient()
}

export async function ensureRedisReady(): Promise<void> {
  const redis = getClient()

  if (redis.isReady) {
    return
  }

  // isOpen true + isReady false means node-redis is already reconnecting on its
  // own; it queues our commands, so there is nothing to do here. Only when the
  // socket is fully closed do we drop the stale promise and dial again.
  if (!redis.isOpen) {
    connectionPromise = undefined
  }

  connectionPromise ??= redis.connect().catch((error) => {
    connectionPromise = undefined
    throw error
  })

  await connectionPromise
}
```

**Ojo:** pégalo entero y luego vas comentando. Las tres cosas que hay que contar están marcadas abajo; el resto es fontanería.

**Dices:**

> Empezamos por lo aburrido, que es la conexión. Aunque tiene un par de cosas que
> no son obvias.
>
> La primera: el cliente se crea la primera vez que hace falta, no al cargar el
> módulo. Si validas la configuración arriba del todo, un despliegue mal
> configurado te revienta al evaluar el bundle, en vez de fallar en la petición
> que de verdad necesita Redis.
>
> Y la segunda, que esta es de las que te muerde: **el listener de errores es
> obligatorio**. No es opcional.

**Dices:**

> node-redis emite un evento `error` cada vez que intenta reconectar. Y en Node, un
> evento `error` sin nadie escuchando no es un warning: **te mata el proceso**. Así
> que sin estas tres líneas, el día que Redis parpadee, se te cae el servidor.

**En pantalla:** señala la línea `attachDatabasePool(client)`.

**Dices:**

> Y la tercera es esta línea suelta, que es la que viene de `@vercel/functions`.
> Te la explico porque es un problema que no ves venir.
>
> Cuando una instancia de Vercel se queda sin tráfico, la plataforma la
> **suspende**: la congela, no la mata. Y una instancia congelada no ejecuta sus
> temporizadores. Ninguno.
>
> ¿Y qué usa un cliente de base de datos para cerrar las conexiones que lleva un
> rato sin usar? Exacto: un temporizador. Así que la conexión no se cierra. Se
> queda ahí abierta, ocupando un hueco en el servidor, hasta que el servidor se
> canse y la tire él. Redis Cloud tarda cinco minutos en hacerlo.
>
> Y ahora ata cabos: el plan gratuito de Redis Cloud te da **treinta** conexiones
> en total. Si cada instancia que se suspende te deja una colgando cinco minutos,
> haces la cuenta enseguida.
>
> Lo que hace `attachDatabasePool` es decirle a Vercel «oye, esto es una conexión a
> base de datos; antes de congelarme, dame un momento para cerrarla bien». Y ya.
>
> En local no hace absolutamente nada: comprueba si está corriendo dentro de Vercel
> y si no, se sale. Así que lo ponemos ahora y nos olvidamos.

### 6.2 Bytes, no texto · el mismo fichero

**Dices:**

> Y ahora el detalle que hace que todo esto funcione, y que es donde se pierde una
> tarde si no lo sabes.
>
> Vamos a guardar el snapshot comprimido con gzip. Y el gzip son **bytes
> binarios**, no texto. Si los tratas como string, UTF-8 te los corrompe por el
> camino y luego no hay manera de descomprimirlos.

*(en el fichero que acabas de pegar, la función `getBufferClient`)*

**Dices:**

> Con esto le decimos al cliente de Redis que en vez de string nos devuelva
> `Buffer`. Y ojo, que esto no abre una segunda conexión: es la misma, solo cambia
> cómo interpreta lo que llega. Así los bytes van y vienen intactos.

### 6.3 Por qué comprimimos

**Dices:**

> Y ya que lo he mencionado: ¿por qué comprimir?
>
> Porque un snapshot es JSON. O sea, muchísimo texto y, sobre todo, los mismos
> nombres de propiedad repetidos cientos de veces. Eso comprime de escándalo.
>
> En este proyecto, cuatrocientos ocho kilobytes de JSON se quedan en ciento
> cuatro. Una cuarta parte.
>
> Y lo bueno es dónde cae el coste. Comprimir se hace **una vez por publicación**.
> Descomprimir, solo cuando una instancia arranca o detecta una versión nueva. Las
> lecturas normales, las de cada visita, trabajan contra el objeto ya
> descomprimido en memoria: esas no pagan nada.

**Ojo:** los números todavía no los puedes enseñar en pantalla — el endpoint que
los devuelve no existe hasta el bloque 8. Aquí los dices, y si quieres los pones
de rótulo. La demo real va en el bloque 10.

### 6.4 Un solo `HSET` · `src/server/snapshot-store.ts`

**Dices:**

> Y vamos con la decisión más importante del bloque. Todo esto lo guardamos en un
> único hash de Redis, y lo escribimos **de una sola vez**.

**`src/server/snapshot-store.ts`** · nuevo · **completo, para pegar**

```ts
import { promisify } from 'node:util'
import { gzip, gunzip } from 'node:zlib'

import { exportSnapshot } from '@content-island/api-client'

import { ensureRedisReady, getBufferClient, getRedis } from './redis'

const gzipAsync = promisify(gzip)
const gunzipAsync = promisify(gunzip)

/**
 * One Redis hash holds the whole published state. Namespacing by project id is
 * what keeps a Preview deployment pointing at a different Content Island
 * project from overwriting Production's snapshot when both share one Redis.
 * With a single project the default key is enough.
 */
export function getSnapshotKey(): string {
  const projectId = process.env.CONTENT_ISLAND_PROJECT_ID

  return projectId
    ? `content-island:${projectId}:snapshot`
    : 'content-island:snapshot'
}

export interface StoredSnapshotMetadata {
  version: string
  encoding: 'gzip'
  compressedSize: number
  uncompressedSize: number
  updatedAt: string
}

export async function saveSnapshot(
  snapshot: unknown,
  version: string,
): Promise<StoredSnapshotMetadata> {
  await ensureRedisReady()

  const json = JSON.stringify(snapshot)
  const uncompressedSize = Buffer.byteLength(json)

  // Level 4 is the sweet spot here: near-level-9 ratio on JSON at a fraction of
  // the CPU. This runs once per publication, so it is never on the read path.
  const compressedSnapshot = await gzipAsync(Buffer.from(json), { level: 4 })

  const metadata: StoredSnapshotMetadata = {
    version,
    encoding: 'gzip',
    compressedSize: compressedSnapshot.byteLength,
    uncompressedSize,
    updatedAt: new Date().toISOString(),
  }

  // A single HSET writes every field atomically, so a reader can never observe
  // the new version number alongside the previous snapshot bytes.
  await getRedis().hSet(getSnapshotKey(), {
    version: metadata.version,
    encoding: metadata.encoding,
    snapshot: compressedSnapshot,
    compressedSize: metadata.compressedSize.toString(),
    uncompressedSize: metadata.uncompressedSize.toString(),
    updatedAt: metadata.updatedAt,
  })

  return metadata
}

/**
 * The cheap poll. Reads one short string, not the megabytes next to it.
 */
export async function getStoredSnapshotVersion(): Promise<string | null> {
  await ensureRedisReady()

  return getRedis().hGet(getSnapshotKey(), 'version')
}

/**
 * Rebuilds the published state straight from Content Island and repopulates
 * Redis. This is the recovery path for an empty key — a first boot, or a Redis
 * plan without persistence that restarted. Without it the whole site would
 * answer 503 until somebody called the refresh endpoint by hand.
 *
 * No distributed lock: if several instances start at once against an empty
 * Redis, each exports its own copy. exportSnapshot() is idempotent and the HSET
 * is atomic, so the result is correct — just wasteful.
 */
async function bootstrapSnapshotJson(): Promise<string> {
  const accessToken = process.env.CONTENT_ISLAND_ACCESS_TOKEN

  if (!accessToken) {
    throw new Error(
      'Redis holds no snapshot and CONTENT_ISLAND_ACCESS_TOKEN is not configured',
    )
  }

  console.warn('[snapshot] Redis is empty, rebuilding from Content Island')

  const snapshot = await exportSnapshot({ accessToken })
  const metadata = await saveSnapshot(snapshot, snapshot.meta.exportedAt)

  console.log(`[snapshot] Redis repopulated with version ${metadata.version}`)

  return JSON.stringify(snapshot)
}

export async function loadSnapshotJson(): Promise<string> {
  await ensureRedisReady()

  const [encodingBuffer, snapshotBuffer] = await getBufferClient().hmGet(
    getSnapshotKey(),
    ['encoding', 'snapshot'],
  )

  if (!snapshotBuffer) {
    return bootstrapSnapshotJson()
  }

  const encoding = encodingBuffer?.toString('utf8')

  if (encoding !== 'gzip') {
    throw new Error(`Unsupported snapshot encoding: ${encoding}`)
  }

  const jsonBuffer = await gunzipAsync(snapshotBuffer)

  return jsonBuffer.toString('utf8')
}
```

*(lo que estamos comentando es el `hSet` de `saveSnapshot`)*

**Dices:**

> ¿Por qué en uno solo y no en varias claves sueltas? Porque un `HSET` es atómico.
>
> Piensa qué pasaría si escribiéramos primero la versión y luego el snapshot. Hay
> un instante, milisegundos, en el que Redis está diciendo «versión nueva» pero
> todavía tiene los bytes viejos. Y si justo en ese instante una instancia
> pregunta, se baja el snapshot antiguo creyendo que es el nuevo. Y se queda así
> hasta la siguiente publicación, sin enterarse.
>
> Escribiéndolo todo de golpe, ese instante no existe.

**Ojo:** si tienes tiempo, aquí va muy bien un dibujito de la línea de tiempo con
el hueco. Es un concepto que se entiende mucho mejor en imagen que hablado.

---

## Bloque 7 · Cambiar el cliente a modo snapshot · ~2 min

**En pantalla:** abres `src/common/api/content-island-client.ts`.

**Dices:**

> Y llegó el momento. Este es el cambio del que te hablaba al principio.

> NOTA MOVER ESTE FICHERO BAJO LA CARPETA SERVER y explicar porque, comentar que podríamos marcar como server

**`src/common/api/content-island-client.ts`** · ya existe · **el cambio, en diff**

```diff
 import { createClient } from "@content-island/api-client";

+import { loadSnapshotJson } from "./snapshot-store";
+
 const accessToken = process.env.CONTENT_ISLAND_ACCESS_TOKEN ?? "";

 export const contentIslandClient = createClient({
   accessToken,
-});
+  mode: "snapshot",
+  snapshotLoader: loadSnapshotJson,
+});
```

Y el fichero entero, por si prefieres reemplazarlo de golpe:

```ts
import { createClient } from '@content-island/api-client'

import { loadSnapshotJson } from '#/server/snapshot-store'

const accessToken = process.env.CONTENT_ISLAND_ACCESS_TOKEN ?? ''

export const contentIslandClient = createClient({
  accessToken,
  mode: 'snapshot',
  // Loader-only on purpose. Passing `snapshotPath` as well would make the
  // client read that file on first load and ignore the loader entirely, so
  // Redis would never be consulted.
  snapshotLoader: loadSnapshotJson,
})
```

**Dices:**

> `mode: 'snapshot'` le dice al cliente que no salga a la red. Y `snapshotLoader`
> es una función nuestra que dice de dónde sacar el JSON: en nuestro caso, de Redis.
>
> Y ya está. Eso es todo.

**En pantalla:** abre `car-list.api.ts` y `car-detail.api.ts` al lado.

**Dices:**

> Los pods no se tocan. `getContentList` sigue igual, con el mismo filtro, el mismo
> `sort`, el mismo `includeRelatedContent`. Pero ahora se resuelve contra memoria.
>
> Esto para mí es lo mejor del diseño: la decisión de _de dónde vienen los datos_ no
> se filtra al resto de la aplicación.

**Ojo:** aquí es el segundo y último momento de venta natural. Que se vea en
pantalla que los ficheros no cambian, y sigue.

**Dices, en tono de aviso:**

> Un detalle que te puede costar una tarde: el cliente también acepta una opción
> `snapshotPath`, para leer de un fichero. Si pones las dos —`snapshotPath` y
> `snapshotLoader`— **gana el fichero** y tu loader no se llama nunca. Y no da
> error, simplemente lee de otro sitio. Aquí queremos solo el loader.

---

## Bloque 8 · El endpoint de refresco · ~3 min

**En pantalla:** creas `src/routes/api.snapshot.refresh.ts`.

**Dices:**

> Ahora necesitamos algo que meta contenido nuevo en Redis. Un endpoint que haga
> cuatro cosas: comprobar que quien llama tiene permiso, pedirle a Content Island
> el snapshot, comprimirlo y guardarlo.

**`src/routes/api.snapshot.refresh.ts`** · nuevo · **completo, para pegar**

```ts
import { createHash, timingSafeEqual } from 'node:crypto'

import { exportSnapshot } from '@content-island/api-client'
import { createFileRoute } from '@tanstack/react-router'

import { saveSnapshot } from '#/server/snapshot-store'

/**
 * Hashing both sides first gives timingSafeEqual two equal-length buffers, so
 * the comparison leaks neither the secret's content nor its length.
 */
function isValidSecret(received: string | null): boolean {
  const expected = process.env.SNAPSHOT_REFRESH_SECRET

  if (!expected || !received) {
    return false
  }

  const expectedHash = createHash('sha256').update(expected).digest()
  const receivedHash = createHash('sha256').update(received).digest()

  return timingSafeEqual(expectedHash, receivedHash)
}

export const Route = createFileRoute('/api/snapshot/refresh')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isValidSecret(request.headers.get('x-refresh-secret'))) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const accessToken = process.env.CONTENT_ISLAND_ACCESS_TOKEN

        if (!accessToken) {
          return Response.json(
            { error: 'CONTENT_ISLAND_ACCESS_TOKEN is not configured' },
            { status: 500 },
          )
        }

        try {
          // exportSnapshot() hits Content Island, validates the shape and the
          // schema version, and resolves with the parsed snapshot. If it throws
          // we never touch Redis, so the previous version stays published.
          const snapshot = await exportSnapshot({ accessToken })

          const metadata = await saveSnapshot(
            snapshot,
            snapshot.meta.exportedAt,
          )

          console.log(
            `[snapshot] stored version ${metadata.version} ` +
              `(${metadata.compressedSize} B gzip / ${metadata.uncompressedSize} B raw)`,
          )

          return Response.json({ status: 'updated', ...metadata })
        } catch (error) {
          console.error('[snapshot] refresh failed', error)

          return Response.json(
            { error: 'Snapshot refresh failed' },
            { status: 500 },
          )
        }
      },
    },
  },
})
```

**Dices:**

> `exportSnapshot` es del cliente de Content Island. Se baja el contenido y de paso
> valida que el formato y la versión de esquema son correctos. Si algo falla, lanza,
> y entonces no llegamos a tocar Redis: la versión anterior sigue publicada tan
> tranquila. Que es justo lo que quieres que pase cuando algo va mal.

**Dices:**

> Y sobre el permiso: es un endpoint público, así que va protegido con un secreto
> compartido en una cabecera.

*(la función `isValidSecret`, arriba del mismo fichero — ya está en lo que has pegado)*

```ts
const expectedHash = createHash("sha256").update(expected).digest();
const receivedHash = createHash("sha256").update(received).digest();

return timingSafeEqual(expectedHash, receivedHash);
```

**Dices:**

> Fíjate que no comparo las cadenas con un `===`. Comparo hashes, y con
> `timingSafeEqual`.
>
> El motivo es un ataque de tiempo. Un `===` normal para de comparar en cuanto
> encuentra una letra distinta, y eso significa que tarda un poquito más cuando has
> acertado las primeras letras. Con muchos intentos y midiendo bien, se puede sacar
> el secreto letra a letra. `timingSafeEqual` siempre tarda lo mismo.
>
> ¿Y por qué hasheo antes? Porque `timingSafeEqual` necesita que los dos trozos
> midan lo mismo, y si compruebo la longitud primero, estoy filtrando la longitud
> del secreto. Hasheando, siempre son treinta y dos bytes, midan lo que midan.

**Ojo:** este trozo es oro para la audiencia. Es un patrón que van a poder usar en
cualquier webhook que escriban en su vida. No lo cortes en edición.

---

## Bloque 9 · Que cada instancia se entere · ~4 min

**En pantalla:** creas `src/server/snapshot-manager.ts`.

**Dices:**

> Nos queda la pieza central: cómo se entera cada instancia de que hay contenido
> nuevo. Y aquí volvemos a lo del bloque tres.

**`src/server/snapshot-manager.ts`** · nuevo · **completo, para pegar**

```ts
import { contentIslandClient } from './content-island-client'

import { getStoredSnapshotVersion } from './snapshot-store'

const DEFAULT_CHECK_INTERVAL_MS = 300_000
const ERROR_RETRY_INTERVAL_MS = 30_000

// Upper bounds on how long a request may wait on Redis. Without them an
// unreachable Redis makes every request hang until node-redis gives up, which
// on a serverless platform is billed function time and a stalled page.
//
// 3s for the check, not 1s: against a managed Redis the budget has to cover a
// reconnection, and node-redis alone allows `connectTimeout ?? 5000` before a
// TLS handshake even starts. 1s was calibrated against local Docker and would
// log spurious failures in production.
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 3_000
const DEFAULT_LOAD_TIMEOUT_MS = 10_000

function readTimeout(name: string, fallback: number): number {
  const configured = Number(process.env[name])

  return Number.isFinite(configured) && configured > 0 ? configured : fallback
}

const VERSION_CHECK_TIMEOUT_MS = readTimeout(
  'SNAPSHOT_VERSION_CHECK_TIMEOUT_MS',
  DEFAULT_VERSION_CHECK_TIMEOUT_MS,
)

const LOAD_TIMEOUT_MS = readTimeout(
  'SNAPSHOT_LOAD_TIMEOUT_MS',
  DEFAULT_LOAD_TIMEOUT_MS,
)

const configuredInterval = Number(process.env.SNAPSHOT_CHECK_INTERVAL_MS)

const CHECK_INTERVAL_MS =
  Number.isFinite(configuredInterval) && configuredInterval > 0
    ? configuredInterval
    : DEFAULT_CHECK_INTERVAL_MS

// Module scope, so this state belongs to ONE serverless instance. Every
// instance tracks its own copy and its own next check independently.
let localVersion: string | undefined
let nextCheckAt = 0

let initializationPromise: Promise<void> | undefined
let checkPromise: Promise<void> | undefined

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    )
  })

  return Promise.race([operation, timeout]).finally(() =>
    clearTimeout(timer),
  ) as Promise<T>
}

async function adoptSnapshot(
  reason: string,
  timeoutMs: number,
): Promise<void> {
  const result = await withTimeout(
    contentIslandClient.refreshSnapshot(),
    timeoutMs,
    'snapshot refresh',
  )

  // `version` in Redis is the snapshot's own `meta.exportedAt`, so the value we
  // get back here is exactly what we will compare against on the next poll.
  localVersion = result.meta.exportedAt
  nextCheckAt = Date.now() + CHECK_INTERVAL_MS

  console.log(
    `[snapshot] ${reason}: ${result.status} (version ${result.meta.exportedAt})`,
  )
}

async function checkCurrentVersion(): Promise<void> {
  const remoteVersion = await withTimeout(
    getStoredSnapshotVersion(),
    VERSION_CHECK_TIMEOUT_MS,
    'Redis version check',
  )

  if (!remoteVersion) {
    // The key vanished under us — a Redis plan with no persistence that
    // restarted, or somebody flushed it. The loader rebuilds from Content
    // Island and repopulates Redis rather than letting the site go down.
    await adoptSnapshot('Redis is empty', LOAD_TIMEOUT_MS)
    return
  }

  if (remoteVersion === localVersion) {
    nextCheckAt = Date.now() + CHECK_INTERVAL_MS
    return
  }

  // refreshSnapshot() runs the loader again, validates the JSON, rejects a
  // snapshot from another project or view, and only swaps it in when it is
  // strictly newer than the active one.
  await adoptSnapshot('new version detected', LOAD_TIMEOUT_MS)
}

export async function ensureFreshSnapshot(): Promise<void> {
  if (localVersion === undefined) {
    // The first request on a cold instance must wait for the whole download.
    // Concurrent requests share this single promise instead of each pulling
    // their own copy out of Redis.
    initializationPromise ??= adoptSnapshot(
      'initial load',
      LOAD_TIMEOUT_MS,
    ).catch((error) => {
      initializationPromise = undefined
      throw error
    })

    await initializationPromise
    return
  }

  if (Date.now() < nextCheckAt) {
    return
  }

  checkPromise ??= checkCurrentVersion()
    .catch((error) => {
      nextCheckAt = Date.now() + ERROR_RETRY_INTERVAL_MS
      // We already hold a valid snapshot in memory. A transient Redis failure
      // must not take the site down; keep serving and retry sooner.
      console.error(
        '[snapshot] could not check Redis; keeping the in-memory snapshot',
        error,
      )
    })
    .finally(() => {
      checkPromise = undefined
    })

  await checkPromise
}
```

**Dices:**

> Estas dos variables están en el ámbito del módulo. O sea, son globales. Y ahora ya
> sabes lo que significa eso en Vercel: **son de esta instancia y de nadie más**. Cada
> instancia lleva su propia cuenta, por su cuenta.

**Dices:**

> La lógica tiene tres escalones. Uno: si esta instancia todavía no tiene snapshot,
> lo carga y bloquea hasta tenerlo. Dos: si lo tiene y no ha pasado el intervalo,
> no hace absolutamente nada.

*(dentro de `ensureFreshSnapshot`, en el mismo fichero)*

```ts
if (Date.now() < nextCheckAt) {
  return;
}
```

> Esta línea es la que se ejecuta el noventa y nueve coma nueve por ciento de las
> veces. Una comparación de números en memoria. Ni red, ni Redis, ni nada.
>
> Y tres: si ha pasado el intervalo, pregunta la versión a Redis. Si coincide, a
> seguir. Si no coincide, entonces sí se baja el snapshot nuevo.

**Dices:**

> Y dos detalles de robustez que en producción marcan la diferencia.
>
> El primero: **timeouts**. Si Redis no contesta, no queremos que la petición se
> quede esperando eternamente. En Vercel eso es tiempo de función que estás pagando
> y una página que no carga. Así que acotamos: tres segundos para preguntar la
> versión, diez para bajarse un snapshot entero.
>
> El segundo: **qué hacer cuando Redis falla**. Y aquí los dos casos se tratan
> distinto a propósito. Si falla mientras arranco y no tengo nada en memoria, no
> hay nada que servir: error. Pero si ya tengo un snapshot bueno en memoria y Redis
> se cae, ¿qué hago? Pues seguir sirviendo. Puede que el contenido esté un poco
> desactualizado, pero la web funciona. Que Redis tenga un mal rato no puede tumbar
> el sitio.

**En pantalla:** el middleware en `src/start.ts`.

**Dices:**

> Y todo esto se engancha en un middleware global, que corre antes de cada petición.

**Dices:**

> Con dos cosas que contar. La primera: el endpoint de refresco **se queda fuera**.
> Tiene que poder funcionar con Redis vacío, porque es justo el que lo llena. Si lo
> cubriera el middleware tendríamos una pescadilla que se muerde la cola.
>
> Y la segunda, que es una trampa de TanStack Start y me la comí en su día. TanStack
> Start te pone un middleware de CSRF por defecto... pero solo mientras **no** tengas
> tu propia configuración global. En cuanto creas este fichero, lo pierdes. Aunque no
> hayas tocado nada más. Así que hay que volver a añadirlo a mano.

**`src/start.ts`** · nuevo · **completo, para pegar**

```ts
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'

import { ensureFreshSnapshot } from '#/server/snapshot-manager'

const REFRESH_ENDPOINT = '/api/snapshot/refresh'

const snapshotMiddleware = createMiddleware().server(
  async ({ pathname, next }) => {
    // The refresh endpoint is the one thing that must work while Redis is still
    // empty; it is what fills it. Gating it behind the snapshot would deadlock.
    if (pathname === REFRESH_ENDPOINT) {
      return next()
    }

    try {
      await ensureFreshSnapshot()
    } catch (error) {
      console.error('[snapshot] unavailable', error)

      return new Response('Content is temporarily unavailable', {
        status: 503,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'retry-after': '30',
        },
      })
    }

    return next()
  },
)

// TanStack Start installs a default CSRF middleware ONLY while no start entry
// exports a `startInstance`. The moment this file exists that default is
// dropped, so we have to re-add it by hand or server functions lose the check.
const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, snapshotMiddleware],
}))
```

> En desarrollo te avisa por consola. En producción, no. Que lo sepas.

---

## Bloque 10 · Demo final · ~3 min

**Ojo:** esta es la parte que se lleva la gente. Ensáyala una vez antes de grabar.
Ten Redis vacío al empezar.

### 10.1 Redis vacío

**En pantalla:** `npm run dev` y cargas la home.

**Dices:**

> Redis está vacío y la web carga igual. ¿Por qué? Porque si no encuentra nada, la
> instancia se lo pide directamente a Content Island y de paso deja Redis
> preparado para las siguientes.

**En pantalla:** `docker compose exec redis redis-cli HGET "content-island:snapshot" version`

**Dices:**

> Y ahí está la versión. Se ha recuperado sola.

### 10.2 El secreto

**En pantalla:** `curl` sin cabecera y con una incorrecta.

**Dices:**

> Sin secreto, cuatrocientos uno. Con un secreto mal, cuatrocientos uno también. Con
> el bueno...

### 10.3 El refresco

**En pantalla:** el `curl` bueno y su respuesta JSON.

**Dices:**

> ...doscientos, y ahí tienes los tamaños. Cuatrocientos ocho kilos a ciento cuatro.

### 10.4 Lo que hemos venido a ver

**En pantalla:** partes la pantalla. Content Island a un lado, la web al otro, y
si puedes el endpoint `/api/content-island/snapshot-info` en una tercera.

**Dices:**

> Y ahora lo bueno. Cambio el precio de este coche en Content Island, y publico.

**En pantalla:** consulta `snapshot-info`.

**Dices:**

> Mira esto un segundo, que es muy didáctico. Este endpoint me dice dos versiones:
> la que está sirviendo esta instancia, y la que hay publicada en Redis. Y ahora
> mismo **no coinciden**.
>
> Eso no es un fallo. Eso es la ventana de consistencia. Redis ya tiene lo nuevo, y
> esta instancia todavía sirve lo anterior porque no le toca preguntar. Dura, como
> mucho, lo que dure el intervalo. Aquí lo tengo en cinco segundos.

**En pantalla:** esperas, recargas la web. Precio nuevo. Vuelves a `snapshot-info`.

**Dices:**

> Y ahora sí. Contenido nuevo, sin desplegar, sin reconstruir. Y en el log ves el
> momento exacto en que esta instancia se ha dado cuenta.

**Ojo:** deja el log visible unos segundos. Que se lea `new version detected`.

---

## Bloque 11 · Cierre · ~1 min

**Dices:**

> Recapitulando lo que hemos montado.
>
> Todo el contenido se sirve desde memoria, sin llamadas de red. Redis guarda cuál
> es la versión vigente. Cada instancia se entera por su cuenta, sin depender de
> que nadie le avise ni de estar viva en el momento justo. Y publicar contenido no
> requiere ni desplegar ni reconstruir nada.
>
> Y los ficheros de datos de la aplicación están exactamente igual que al empezar.
>
> En el siguiente vídeo esto se va a Vercel de verdad: Redis gestionado, variables
> de entorno, y automatizamos el refresco para que se dispare solo cuando publicas,
> con un webhook. Porque a día de hoy seguimos llamando al endpoint a mano, y eso
> hay que arreglarlo.
>
> Nos vemos en el siguiente.

---

## Apéndice · Preguntas que te van a hacer

Ténlas preparadas para los comentarios, o mételas como cierre alternativo.

**«¿Y si el snapshot es enorme?»**
El límite de Content Island son 16 MB, que comprimidos se quedan en unos 3 o 4.
Cabe de sobra en Redis. Lo que sí conviene es vigilar el `compressedSize` que
devuelve el endpoint, que para eso lo guardamos.

**«¿Cuánto pongo de intervalo?»**
En local, 5 segundos, para ver los cambios mientras pruebas. En producción, entre
30 segundos y 5 minutos. Es un cambio directo: menos intervalo es más frescura y
más consultas; más intervalo es lo contrario. Y recuerda que la consulta solo se
baja el número de versión.

**«¿Y si se cae Redis?»**
Si la instancia ya tiene snapshot en memoria, sigue sirviendo tan tranquila y
reintenta más a menudo. Si es una instancia recién creada que no tiene nada,
entonces sí, no puede responder.

**«¿Esto vale para Next, Astro, Nuxt...?»**
El patrón sí, tal cual: Redis como fuente de verdad, memoria como caché, y una
comprobación de versión periódica. Lo que cambia es dónde enganchas el
middleware, que es cosa de cada framework.

**«¿Puedo hacer rollback a una versión anterior?»**
No por este camino. El cliente solo adopta un snapshot **más nuevo** que el que
tiene, para protegerte de publicar hacia atrás por accidente. Si quieres volver a
un estado anterior, se republica en Content Island.
