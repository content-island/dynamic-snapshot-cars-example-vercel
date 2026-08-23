# 01-local — Dynamic Snapshot con Redis, en local

*[English version](./README.md)*

Partimos de `00-start`, que resuelve cada petición llamando a la API de Content
Island, y lo convertimos en una aplicación que sirve **todo el contenido desde
un snapshot en memoria**, con **Redis como fuente de verdad**.

Este paso se queda en local. El despliegue en Vercel es `02-deploy`.

---

## 1. El problema

En un servidor Node tradicional (Azure App Service, un VPS, un contenedor) hay
uno o pocos procesos que viven mucho tiempo. Cargas el snapshot al arrancar y lo
conservas en memoria hasta el siguiente reinicio. Fácil.

Vercel Functions no funciona así:

- Crea **varias instancias** para atender tráfico concurrente.
- **Reutiliza** una instancia y su memoria entre peticiones.
- **Pausa** una instancia cuando deja de recibir tráfico.
- La **destruye** y crea otra más tarde.
- Una variable global pertenece **solo a esa instancia**.
- No hay ninguna API para decirle a todas las instancias vivas «actualizad».

De ahí sale la regla que gobierna todo el diseño:

> La memoria es una caché rapidísima, pero **no puede ser la fuente de verdad**.

### Por qué no basta con Redis Pub/Sub

La [documentación de Content Island](https://www.contentisland.net/es/blog/content-island-ssr-dynamic-snapshot/)
propone Pub/Sub como opción para multi-instancia. Para un pool de contenedores
estables es una buena opción. Para Vercel **no es suficiente por sí sola**:
Pub/Sub entrega el mensaje únicamente a los suscriptores conectados **en ese
instante**. Una instancia pausada, desconectada o que todavía no existe se
pierde la notificación y no hay forma de saberlo.

Por eso aquí **invertimos el modelo**: en vez de que Redis avise, cada instancia
**pregunta**. Y pregunta barato.

| Pieza | Responsabilidad |
| --- | --- |
| Redis | Fuente de verdad del snapshot vigente |
| Memoria de la Function | Copia rápida, para las lecturas |
| API de Content Island | Origen para generar versiones nuevas |

Pub/Sub se podría añadir después como optimización para propagar antes los
cambios, pero la comprobación de versión tendría que seguir existiendo igual.

### Por qué Redis y no Vercel Blob

Blob está pensado para ficheros cacheables e inmutables. Aquí necesitamos
justo lo contrario: sobrescribir siempre un único estado vigente y leer muy a
menudo un valor diminuto (la versión). Con Redis eso es un hash y un `HGET`.

---

## 2. Arquitectura

```text
Content Island
      │  publicación de contenido
      ▼
(en 02-deploy: webhook → GitHub Action)
      │  POST autenticado
      ▼
/api/snapshot/refresh
      │
      ├── exportSnapshot()      ← descarga y valida
      ├── JSON.stringify()
      ├── gzip                  ← 408 KB → 104 KB medidos
      └── HSET atómico
              │
              ▼
            Redis          version + snapshot + metadatos
              │
              ▼
Middleware global de TanStack Start
      │
      ├── ¿ha pasado el intervalo?  no → sigue con lo que tiene en memoria
      └── sí → HGET version
                 ├── igual    → nada
                 └── distinta → refreshSnapshot()
                                    │
                                    ▼
                        Snapshot descomprimido en memoria
                                    │
                                    ▼
                              Respuestas SSR
```

La clave del rendimiento está en el reparto: la comprobación periódica lee
**un string corto**; el snapshot entero solo viaja cuando la versión cambia.

---

## 3. Redis en local con Docker

`docker-compose.yml`:

```yaml
services:
  redis:
    image: redis:8-alpine
    container_name: content-island-redis
    command: redis-server --appendonly yes

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

```bash
docker compose up -d
docker compose exec redis redis-cli ping   # PONG
```

El puerto se publica solo en `127.0.0.1`, así que Redis no queda expuesto a la
red. `--appendonly yes` + el volumen hacen que el snapshot sobreviva a un
reinicio del contenedor, cosa que se agradece mientras desarrollas.

---

## 4. Dependencias y variables

```bash
npm install redis
```

`zlib`, `util` y `crypto` vienen con Node.

`.env` (mira `.env.example`):

```env
CONTENT_ISLAND_ACCESS_TOKEN=tu_token
CONTENT_ISLAND_PROJECT_ID=
REDIS_URL=redis://localhost:6379
SNAPSHOT_REFRESH_SECRET=un_secreto_largo_y_aleatorio
SNAPSHOT_CHECK_INTERVAL_MS=5000
```

Genera el secreto con `openssl rand -base64 32`.

`SNAPSHOT_CHECK_INTERVAL_MS` a 5 s en local para ver los cambios enseguida. En
producción, entre 30 s y 5 min.

`CONTENT_ISLAND_PROJECT_ID` es **opcional**: solo sirve para prefijar la clave de
Redis, de modo que dos entornos que apunten a proyectos distintos de Content
Island puedan compartir una misma instancia de Redis sin pisarse. Si lo dejas
vacío, la clave es `content-island:snapshot`.

---

## 5. La conexión a Redis

`src/server/redis.ts` expone tres cosas: el cliente, un cliente gemelo que
devuelve `Buffer`, y una función que garantiza que hay conexión.

```ts
export function getBufferClient() {
  if (!bufferClient) {
    bufferClient = getClient().withTypeMapping({
      [RESP_TYPES.BLOB_STRING]: Buffer,
    })
  }

  return bufferClient
}
```

`withTypeMapping` es la pieza que permite guardar el gzip **como bytes**, sin
pasar por Base64 y sin que UTF-8 corrompa nada. Es la misma conexión: no abre un
segundo socket.

Tres detalles que no son evidentes:

1. **El cliente se crea al primer uso, no al cargar el módulo.** Si validas
   `REDIS_URL` en el ámbito del módulo, un despliegue mal configurado revienta al
   evaluar el bundle en vez de fallar en la petición que necesita Redis.
2. **El listener de `error` es obligatorio.** node-redis emite `error` en cada
   intento de reconexión; sin listener, Node lo trata como un `error` no
   gestionado y **mata el proceso**.
3. **`isOpen` e `isReady` no son lo mismo.** `isOpen && !isReady` significa que
   node-redis ya se está reconectando solo y encola los comandos: no hay que
   hacer nada. Solo cuando el socket está cerrado del todo hay que descartar la
   promesa de conexión anterior y volver a marcar.

```ts
export async function ensureRedisReady(): Promise<void> {
  const redis = getClient()

  if (redis.isReady) {
    return
  }

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

---

## 6. El almacén: gzip + un `HSET`

`src/server/snapshot-store.ts`. Todo el estado publicado vive en **un solo hash**:

```text
content-island:snapshot
├── version            ← el meta.exportedAt del snapshot
├── encoding           ← "gzip"
├── snapshot           ← bytes comprimidos
├── compressedSize
├── uncompressedSize
└── updatedAt
```

```ts
// Un único HSET escribe todos los campos de forma atómica, así que un lector
// nunca puede ver la versión nueva junto a los bytes del snapshot antiguo.
await getRedis().hSet(getSnapshotKey(), {
  version: metadata.version,
  encoding: metadata.encoding,
  snapshot: compressedSnapshot,
  compressedSize: metadata.compressedSize.toString(),
  uncompressedSize: metadata.uncompressedSize.toString(),
  updatedAt: metadata.updatedAt,
})
```

Esa atomicidad es la razón de usar un hash y no varias claves sueltas.

### ¿Por qué comprimir?

Un snapshot es JSON: mucho texto y muchísimos nombres de propiedad repetidos.
Comprime muy bien.

Medido en este proyecto: **408 067 B → 104 292 B**, un 25 % del original.

> El borrador de la guía prometía «entre un 80 % y un 90 %» de reducción. En
> este proyecto la reducción real es del **74 %**. Sigue mereciendo muchísimo la
> pena, pero conviene dar el número medido y no una promesa.

La compresión ocurre **una vez por publicación**. La descompresión, solo cuando
una instancia arranca o detecta versión nueva. Las lecturas normales trabajan
sobre el objeto ya descomprimido en memoria.

Usamos `level: 4`: casi el ratio del nivel 9 a una fracción del coste de CPU. Y
las variantes asíncronas de `zlib`, para no bloquear el event loop.

La lectura pide `encoding` y `snapshot` en un solo `hmGet`, y valida el
`encoding` antes de descomprimir; así el día que quieras añadir otro algoritmo,
el código viejo falla claro en lugar de reventar dentro de `gunzip`.

---

## 7. El cliente en modo snapshot

`src/common/api/content-island-client.ts`:

```ts
export const contentIslandClient = createClient({
  accessToken,
  mode: 'snapshot',
  snapshotLoader: loadSnapshotJson,
})
```

**No hay que tocar `car-list.api.ts` ni `car-detail.api.ts`.** Sus
`getContentList()` siguen igual; ahora se resuelven contra el snapshot en
memoria.

> ⚠️ **El detalle que te puede costar una tarde.** Si además de `snapshotLoader`
> pasas `snapshotPath`, el cliente lee **el fichero** y **el loader nunca se
> llama**. La condición dentro del cliente es literalmente
> «si no hay `snapshotPath` y sí hay `snapshotLoader`, usa el loader; si no, lee
> el fichero». Loader-only es obligatorio aquí, y por eso `00-start` traía un
> `content-island-snapshot.json` que en `01-local` ya no existe.

---

## 8. El endpoint que actualiza Redis

`src/routes/api.snapshot.refresh.ts`. Hace cuatro cosas: valida el secreto,
descarga con `exportSnapshot()`, comprime y guarda.

```ts
const snapshot = await exportSnapshot({ accessToken })
const metadata = await saveSnapshot(snapshot, snapshot.meta.exportedAt)
```

`exportSnapshot()` valida forma y versión de esquema. Si falla, **no tocamos
Redis**, así que la versión anterior sigue publicada.

Sobre el secreto: comparamos **hashes SHA-256**, no las cadenas.

```ts
const expectedHash = createHash('sha256').update(expected).digest()
const receivedHash = createHash('sha256').update(received).digest()

return timingSafeEqual(expectedHash, receivedHash)
```

> El borrador comparaba longitudes primero y devolvía `false` si diferían. Eso
> hace que `timingSafeEqual` no reciba buffers desiguales (que lanzaría), pero
> **filtra la longitud del secreto** por tiempo de respuesta. Hasheando los dos
> lados obtienes siempre 32 bytes y la comparación no filtra ni contenido ni
> longitud.

---

## 9. El gestor de versiones

`src/server/snapshot-manager.ts` es el cerebro. Estado en el ámbito del módulo,
es decir **de una única instancia**:

```ts
let localVersion: string | undefined
let nextCheckAt = 0
```

`ensureFreshSnapshot()` decide en tres escalones:

1. **Sin snapshot todavía** → carga inicial bloqueante. Las peticiones
   concurrentes comparten **una sola** promesa en vez de bajarse cada una su
   copia de Redis.
2. **Dentro del intervalo** → no toca Redis. Esta es la rama que se ejecuta el
   99,9 % de las veces, y es una comparación de números en memoria.
3. **Fuera del intervalo** → un `HGET version`. Si coincide, nada. Si no,
   `refreshSnapshot()`.

```ts
if (Date.now() < nextCheckAt) {
  return
}
```

> **Mejora respecto al borrador.** El borrador comparaba la versión de Redis
> contra `contentIslandClient.getSnapshotInfo()`. Funciona, pero es una llamada
> de más al cliente en cada comprobación. Aquí guardamos la versión que devuelve
> `refreshSnapshot()` en `result.meta.exportedAt`. Es exactamente el mismo valor
> que guardamos en Redis, porque `version` **es** `meta.exportedAt`, así que la
> comparación es directa y sin intermediarios.

### Los timeouts

```ts
const VERSION_CHECK_TIMEOUT_MS = 1_000
const INITIAL_LOAD_TIMEOUT_MS = 10_000
```

> **Esto no estaba en el borrador y es importante.** Sin acotar, un Redis
> inalcanzable deja **cada** petición esperando hasta que node-redis se rinde.
> En local eso son segundos; en Vercel es tiempo de función facturado y una
> página colgada. Medido en este proyecto, con Redis parado: **1,05 s** con el
> timeout puesto, frente a colgarse hasta el `TimeoutError` del cliente.

### Tolerancia a fallos

Los dos casos se tratan distinto **a propósito**:

- **Carga inicial falla** → propaga el error → el middleware devuelve `503`. No
  hay nada válido que servir.
- **Comprobación posterior falla** → se registra, **se conserva el snapshot en
  memoria** y se adelanta el siguiente reintento a 30 s. Un fallo temporal de
  Redis no debe tirar la web.

---

## 10. El middleware global

`src/start.ts`:

```ts
const snapshotMiddleware = createMiddleware().server(
  async ({ pathname, next }) => {
    if (pathname === REFRESH_ENDPOINT) {
      return next()
    }

    try {
      await ensureFreshSnapshot()
    } catch (error) {
      return new Response('Content is temporarily unavailable', {
        status: 503,
        headers: { 'retry-after': '30', /* ... */ },
      })
    }

    return next()
  },
)
```

Tres cosas que conviene tener claras:

**El endpoint de refresco se excluye.** Es el único que tiene que funcionar con
Redis vacío, porque es el que lo llena. Si lo cubriera el middleware, tendrías
un bloqueo mutuo: para servir necesitas snapshot, y para tener snapshot
necesitas servir ese endpoint.

**`pathname` te lo dan hecho.** El contexto del middleware de petición es
`{ request, pathname, context, next, handlerType, serverFnMeta }`. El borrador
hacía `new URL(request.url).pathname`; no hace falta.

**Devolver un `Response` corta la cadena.** No hay que llamar a `next()`: el
handler puede devolver directamente un `Response` y ni el middleware posterior
ni el handler final se ejecutan.

### El CSRF: la trampa

```ts
const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, snapshotMiddleware],
}))
```

TanStack Start instala su middleware CSRF por defecto **solo mientras no exista
un `startInstance`**. La condición interna mira si hay start entry, **no** si esa
instancia trae `requestMiddleware`. Es decir: **en el momento en que creas
`src/start.ts`, pierdes el CSRF**, aunque no toques nada más.

| Situación | `requestMiddleware` efectivo |
| --- | --- |
| Sin `src/start.ts` | `[csrfPorDefecto]` |
| `createStart(() => ({}))` | `undefined` → **CSRF perdido** |
| `createStart(() => ({ requestMiddleware: [mío] }))` | `[mío]` → **CSRF perdido** |

Por eso lo volvemos a añadir a mano. En desarrollo TanStack Start avisa por
consola si falta; en producción, no.

El middleware se ejecuta para SSR, para Server Routes y para Server Functions.
Aunque corre en cada petición, casi siempre termina en la comparación de
`nextCheckAt` en memoria.

---

## 11. Probarlo en local

```bash
docker compose up -d
npm run dev
```

### 11.1. Redis vacío → 503

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
# 503
```

Es el comportamiento correcto: no hay snapshot válido que servir.

### 11.2. Autenticación

```bash
curl -i -X POST http://localhost:3000/api/snapshot/refresh
# 401

curl -i -X POST http://localhost:3000/api/snapshot/refresh \
  -H "x-refresh-secret: incorrecto"
# 401
```

### 11.3. Primer snapshot

```bash
export SNAPSHOT_REFRESH_SECRET=$(grep '^SNAPSHOT_REFRESH_SECRET=' .env | cut -d= -f2-)

curl -s -X POST http://localhost:3000/api/snapshot/refresh \
  -H "x-refresh-secret: $SNAPSHOT_REFRESH_SECRET"
```

```json
{
  "status": "updated",
  "version": "2026-08-23T14:19:01.116Z",
  "encoding": "gzip",
  "compressedSize": 104292,
  "uncompressedSize": 408067,
  "updatedAt": "2026-08-23T14:19:01.116Z"
}
```

Ahora `/` y `/cars` responden `200` sirviendo desde memoria.

### 11.4. Inspeccionar Redis

```bash
docker compose exec redis redis-cli HKEYS "content-island:snapshot"
docker compose exec redis redis-cli HGET  "content-island:snapshot" version
```

El campo `snapshot` es binario; no intentes leerlo por consola.

### 11.5. El endpoint de diagnóstico

`GET /api/content-island/snapshot-info` compara lo que sirve **esta** instancia
con lo que publica Redis:

```json
{
  "redisKey": "content-island:snapshot",
  "local":  { "exportedAt": "2026-08-23T14:19:18.216Z", "view": "published", ... },
  "remoteVersion": "2026-08-23T14:19:45.910Z",
  "inSync": false
}
```

`inSync: false` es exactamente la **ventana de consistencia**: dura como mucho
un `SNAPSHOT_CHECK_INTERVAL_MS`. Verlo con los ojos es la mejor forma de
entender el modelo.

### 11.6. Actualización automática

1. Publica un cambio en Content Island (o simplemente vuelve a llamar al
   endpoint de refresco).
2. Consulta `/api/content-island/snapshot-info` → `inSync: false`.
3. Espera el intervalo (5 s en local) y pide cualquier página.
4. Vuelve a consultar → `inSync: true`, y en el log verás
   `[snapshot] new version detected`.

---

## 12. Qué se ha verificado

| Escenario | Resultado |
| --- | --- |
| Redis vacío, `GET /` | `503` con `retry-after: 30` |
| `POST /refresh` sin secreto / con secreto incorrecto | `401`, Redis intacto |
| `POST /refresh` con secreto correcto | `200`, 408 067 B → 104 292 B |
| `GET /`, `GET /cars` tras el refresco | `200` desde memoria |
| Round-trip gzip binario por Redis | bytes idénticos, UTF-8 multibyte intacto |
| Versión nueva dentro del intervalo | `inSync: false`, se sigue sirviendo la vieja |
| Versión nueva pasado el intervalo | detectada y adoptada sola |
| Redis caído, snapshot en memoria | sigue sirviendo `200` |
| Redis caído, latencia | acotada a 1,05 s; siguientes peticiones a 35 ms |
| Redis restaurado | vuelve a comprobar y sincroniza |

---

## 13. Límites conocidos

**`exportedAt` cambia en cada export, publiques o no.** Dos exports seguidos sin
tocar contenido dan versiones distintas (`14:19:01.116Z` → `14:19:18.216Z`
medidos aquí). Es decir: **cada llamada al endpoint de refresco obliga a todas
las instancias a rebajarse el snapshot entero**, aunque el contenido sea
idéntico. No llames al refresco «por si acaso»; llámalo cuando se publique.

**No hay rollback.** El cliente solo adopta un snapshot **estrictamente más
nuevo** (`incoming.exportedAt <= activo.exportedAt` → `unchanged`). Si necesitas
volver atrás, tienes que republicar en Content Island, no restaurar un snapshot
viejo en Redis.

**Un snapshot de otro proyecto se rechaza.** El cliente lanza error si el
`projectId` o el `view` del snapshot entrante no coinciden con el activo. Es una
protección buena, pero significa que **no puedes compartir una clave de Redis
entre dos proyectos** de Content Island: para eso está
`CONTENT_ISLAND_PROJECT_ID`.

**Ventana de consistencia.** Con el intervalo a 5 min, una instancia puede
servir hasta 5 min una versión anterior. Bajarlo mejora la frescura y aumenta
los `HGET`. Solo se descarga `version`, que son unas decenas de bytes.

**Redis es dependencia crítica para arrancar.** Una vez cargado el snapshot,
Content Island sale del camino de lectura. Pero una instancia nueva **necesita**
Redis para su primera copia. Sin Redis y sin memoria, `503`.

**Tamaño.** Los snapshots pueden llegar a 16 MB. Guardamos `compressedSize`
precisamente para poder vigilarlo antes de chocar con los límites del
proveedor.

---

## 14. Qué queda para `02-deploy`

- Redis gestionado desde el Marketplace de Vercel.
- Variables de entorno en Vercel y `SNAPSHOT_CHECK_INTERVAL_MS` realista.
- Inicializar el Redis de producción.
- Webhook de Content Island → `repository_dispatch` → GitHub Action → endpoint
  de refresco.
- PAT de GitHub con los permisos justos.

---

## 15. Referencias

- [Dynamic Snapshots — visión general](https://docs.contentisland.net/dynamic-snapshots/overview/)
- [Snapshot mode en Content Island](https://www.contentisland.net/es/blog/new-spnapshot-mode-content-island/)
- [SSR con Dynamic Snapshot](https://www.contentisland.net/es/blog/content-island-ssr-dynamic-snapshot/)
- [`exportSnapshot`](https://docs.contentisland.net/es/client-api/export-snapshot/)
- [`refreshSnapshot`](https://docs.contentisland.net/es/client-api/refresh-snapshot/)
- [`getSnapshotInfo`](https://docs.contentisland.net/es/client-api/get-snapshot-info/)
- [Middleware de TanStack Start](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [`HSET`](https://redis.io/docs/latest/commands/hset/) · [node-redis](https://github.com/redis/node-redis)
