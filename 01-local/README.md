# 01-local — Dynamic Snapshot with Redis, running locally

*[Versión en español](./README_es.md)*

We start from `00-start`, which resolves every request by calling the Content
Island API, and turn it into an application that serves **all of its content
from an in-memory snapshot**, with **Redis as the source of truth**.

This step stays local. Deploying to Vercel is `02-deploy`.

---

## 1. The problem

On a traditional Node server (Azure App Service, a VPS, a container) you have
one or a few processes that live for a long time. You load the snapshot at
startup and keep it in memory until the next restart. Easy.

Vercel Functions does not work that way:

- It creates **several instances** to handle concurrent traffic.
- It **reuses** an instance and its memory across requests.
- It **pauses** an instance when traffic stops.
- It **destroys** it and creates another one later.
- A global variable belongs **only to that instance**.
- There is no API to tell every live instance "refresh yourselves".

Hence the rule that governs the whole design:

> Memory is a blazing-fast cache, but it **cannot be the source of truth**.

### Why Redis Pub/Sub is not enough on its own

The [Content Island documentation](https://www.contentisland.net/es/blog/content-island-ssr-dynamic-snapshot/)
suggests Pub/Sub as the multi-instance option. For a pool of stable containers
that is a good fit. For Vercel it is **not sufficient by itself**: Pub/Sub only
delivers a message to the subscribers connected **at that instant**. An instance
that is paused, disconnected, or does not exist yet misses the notification, and
there is no way to know.

So here we **invert the model**: instead of Redis announcing, each instance
**asks**. And it asks cheaply.

| Piece | Responsibility |
| --- | --- |
| Redis | Source of truth for the current snapshot |
| Function memory | Fast copy, used for reads |
| Content Island API | Origin for generating new versions |

Pub/Sub could be added later as an optimisation to propagate changes sooner, but
the version check would still have to exist.

### Why Redis and not Vercel Blob

Blob is designed for cacheable, immutable files. We need the opposite: always
overwrite a single current state, and very frequently read a tiny value (the
version). With Redis that is one hash and one `HGET`.

---

## 2. Architecture

```text
Content Island
      │  content is published
      ▼
(in 02-deploy: webhook → GitHub Action)
      │  authenticated POST
      ▼
/api/snapshot/refresh
      │
      ├── exportSnapshot()      ← download and validate
      ├── JSON.stringify()
      ├── gzip                  ← 408 KB → 104 KB measured
      └── atomic HSET
              │
              ▼
            Redis          version + snapshot + metadata
              │
              ▼
TanStack Start global middleware
      │
      ├── has the interval elapsed?  no → keep using what is in memory
      └── yes → HGET version
                 ├── same      → nothing
                 └── different → refreshSnapshot()
                                    │
                                    ▼
                        Decompressed snapshot in memory
                                    │
                                    ▼
                              SSR responses
```

The performance comes from that split: the periodic check reads **one short
string**; the full snapshot only travels when the version changes.

---

## 3. Redis locally with Docker

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

The port is published on `127.0.0.1` only, so Redis is not exposed to the
network. `--appendonly yes` plus the volume make the snapshot survive a
container restart, which you will appreciate while developing.

---

## 4. Dependencies and environment

```bash
npm install redis @vercel/functions
```

`redis` is the official Redis client for Node. `@vercel/functions` holds helpers
for code running inside a Vercel Function; we use exactly one of them,
`attachDatabasePool` (see section 6). It is a no-op outside Vercel, so it does
not get in the way locally.

`zlib`, `util` and `crypto` ship with Node.

`.env` (see `.env.example`):

```env
CONTENT_ISLAND_ACCESS_TOKEN=your_token
CONTENT_ISLAND_PROJECT_ID=
REDIS_URL=redis://localhost:6379
SNAPSHOT_REFRESH_SECRET=a_long_random_secret
SNAPSHOT_CHECK_INTERVAL_MS=5000
```

Generate the secret with `openssl rand -base64 32`.

`SNAPSHOT_CHECK_INTERVAL_MS` is 5 s locally so you see changes right away. In
production, somewhere between 30 s and 5 min.

`CONTENT_ISLAND_PROJECT_ID` is **optional**: it only prefixes the Redis key, so
two environments pointing at different Content Island projects can share one
Redis instance without clobbering each other. Leave it empty and the key is
`content-island:snapshot`.

---

## 5. Keeping `src/server/` out of the browser

Everything under `src/server/` handles secrets: the Content Island token, the
Redis URL (password included) and the refresh endpoint's secret. None of it may
end up in the client bundle.

**In TanStack Start code is isomorphic by default** — its own guide flags this as
*CRITICAL*: "All code is ISOMORPHIC by default". There is no automatic split by
folder. You have to declare it.

Declare it in `vite.config.ts`:

```ts
tanstackStart({
  importProtection: {
    client: {
      files: ["**/src/server/**"],
    },
  },
});
```

If anyone imports from `src/server/` in a component, **the build fails** with the
full trace of who imported what:

```text
[import-protection] Import denied in client environment

  Denied by file pattern: **/src/server/**
  Importer: src/routes/index.tsx:14:29
  Import: "#/server/probe"
  Resolved: src/server/probe.ts
```

### Why the folder and not `*.server.ts`

TanStack Start ships a `*.server.*` convention that works just as well. But it
only protects the files you remembered to rename. Protecting the folder also
covers the ones that do not exist yet.

This is not theoretical. Measured in this project, importing a `src/server/probe.ts`
holding a single constant from a client component:

| | Build | Reaches the browser? |
| --- | --- | --- |
| Without the rule | **passes, green** | **yes — the constant landed in `.output/public/assets/*.js`** |
| With the rule | fails | no |

The current code did not leak only because it drags in `node:zlib` and
`node:crypto`, which breaks the client bundle for an unrelated reason. A server
file with no Node dependencies — a constant, a `fetch` — leaked **silently**.

---

## 6. The Redis connection

`src/server/redis.ts` exposes three things: the client, a twin client that
returns `Buffer`, and a function that guarantees a connection.

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

`withTypeMapping` is the piece that lets us store the gzip **as bytes**, with no
Base64 round-trip and nothing for UTF-8 to corrupt. It is the same connection: it
does not open a second socket.

Three details that are not obvious:

1. **The client is created on first use, not at module load.** If you validate
   `REDIS_URL` at module scope, a misconfigured deployment blows up while
   evaluating the bundle instead of failing the request that actually needs
   Redis.
2. **The `error` listener is mandatory.** node-redis emits `error` on every
   reconnection attempt; with no listener, Node treats it as an unhandled
   `error` event and **kills the process**.
3. **`isOpen` and `isReady` are not the same.** `isOpen && !isReady` means
   node-redis is already reconnecting on its own and queues commands: there is
   nothing to do. Only when the socket is fully closed should you drop the
   previous connection promise and dial again.

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

## 7. The store: gzip plus one `HSET`

`src/server/snapshot-store.ts`. All the published state lives in **a single
hash**:

```text
content-island:snapshot
├── version            ← the snapshot's own meta.exportedAt
├── encoding           ← "gzip"
├── snapshot           ← compressed bytes
├── compressedSize
├── uncompressedSize
└── updatedAt
```

```ts
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
```

That atomicity is the reason for a hash rather than several separate keys.

### Why compress?

A snapshot is JSON: a lot of text and a great many repeated property names. It
compresses very well.

Measured in this project: **408,067 B → 104,292 B**, 25 % of the original.

> The draft guide promised "between 80 % and 90 %" reduction. The real reduction
> in this project is **74 %**. Still very much worth it, but it is better to
> quote the measured number than a promise.

Compression happens **once per publication**. Decompression happens only when an
instance starts or detects a new version. Normal reads work against the object
already decompressed in memory.

We use `level: 4`: nearly the level-9 ratio at a fraction of the CPU. And the
async `zlib` variants, to avoid blocking the event loop.

The read asks for `encoding` and `snapshot` in a single `hmGet`, and validates
`encoding` before decompressing; that way, the day you add another algorithm,
old code fails clearly instead of exploding inside `gunzip`.

---

## 8. The client in snapshot mode

`src/common/api/content-island-client.ts`:

```ts
export const contentIslandClient = createClient({
  accessToken,
  mode: 'snapshot',
  snapshotLoader: loadSnapshotJson,
})
```

**No need to touch `car-list.api.ts` or `car-detail.api.ts`.** Their
`getContentList()` calls stay the same; they now resolve against the in-memory
snapshot.

> ⚠️ **The detail that can cost you an afternoon.** If you pass `snapshotPath`
> alongside `snapshotLoader`, the client reads **the file** and **the loader is
> never called**. The condition inside the client is literally "if there is no
> `snapshotPath` and there is a `snapshotLoader`, use the loader; otherwise read
> the file". Loader-only is mandatory here, which is why the
> `content-island-snapshot.json` that `00-start` shipped no longer exists in
> `01-local`.

---

## 9. The endpoint that updates Redis

`src/routes/api.snapshot.refresh.ts`. It does four things: validate the secret,
download via `exportSnapshot()`, compress, and store.

```ts
const snapshot = await exportSnapshot({ accessToken })
const metadata = await saveSnapshot(snapshot, snapshot.meta.exportedAt)
```

`exportSnapshot()` validates shape and schema version. If it fails we **never
touch Redis**, so the previous version stays published.

About the secret: we compare **SHA-256 hashes**, not the strings.

```ts
const expectedHash = createHash('sha256').update(expected).digest()
const receivedHash = createHash('sha256').update(received).digest()

return timingSafeEqual(expectedHash, receivedHash)
```

> The draft compared lengths first and returned `false` when they differed. That
> keeps `timingSafeEqual` from receiving unequal buffers (which would throw), but
> it **leaks the secret's length** through response timing. Hashing both sides
> always gives you 32 bytes, and the comparison leaks neither content nor
> length.

---

## 10. The version manager

`src/server/snapshot-manager.ts` is the brain. State at module scope, which
means **per instance**:

```ts
let localVersion: string | undefined
let nextCheckAt = 0
```

`ensureFreshSnapshot()` decides in three tiers:

1. **No snapshot yet** → blocking initial load. Concurrent requests share **one**
   promise instead of each pulling its own copy out of Redis.
2. **Within the interval** → does not touch Redis. This is the branch that runs
   99.9 % of the time, and it is a number comparison in memory.
3. **Past the interval** → one `HGET version`. If it matches, nothing. If not,
   `refreshSnapshot()`.

```ts
if (Date.now() < nextCheckAt) {
  return
}
```

> **Improvement over the draft.** The draft compared the Redis version against
> `contentIslandClient.getSnapshotInfo()`. That works, but it is an extra client
> call on every check. Here we keep the version returned by `refreshSnapshot()`
> in `result.meta.exportedAt`. It is exactly the value we store in Redis, because
> `version` **is** `meta.exportedAt`, so the comparison is direct.

### The timeouts

```ts
const DEFAULT_VERSION_CHECK_TIMEOUT_MS = 3_000
const DEFAULT_LOAD_TIMEOUT_MS = 10_000
```

Both are overridable with `SNAPSHOT_VERSION_CHECK_TIMEOUT_MS` and
`SNAPSHOT_LOAD_TIMEOUT_MS`.

> **This was not in the draft and it matters.** Unbounded, an unreachable Redis
> leaves **every** request waiting until node-redis gives up. Locally that is
> seconds; on Vercel it is billed function time and a stalled page. Measured
> with Redis stopped: **3.06 s** with the timeout in place, versus hanging until
> the client's own `TimeoutError`.
>
> Why 3 s and not 1 s: 1 s was calibrated against local Docker, where a round
> trip is sub-millisecond. Against a managed Redis the budget has to cover a
> **reconnection**, and node-redis alone allows `connectTimeout ?? 5000` before
> a TLS handshake even begins. At 1 s every reconnect would log a spurious
> failure.

### Fault tolerance

The two cases are handled differently **on purpose**:

- **Redis is reachable but empty** → rebuild from Content Island, repopulate
  Redis, carry on. See section 14: a free Redis plan has no persistence, so this
  is not a hypothetical.
- **Redis is unreachable on a cold instance** → propagate the error → the
  middleware returns `503`. There is nothing valid to serve.
- **A later check fails** → log it, **keep the in-memory snapshot**, and bring
  the next retry forward to 30 s. A transient Redis failure must not take the
  site down.

---

## 11. The global middleware

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

Three things worth being clear about:

**The refresh endpoint is excluded.** It is the only one that has to work with
an empty Redis, because it is what fills it. If the middleware covered it you
would have a deadlock: to serve you need a snapshot, and to have a snapshot you
need to serve that endpoint.

**`pathname` is handed to you.** The request middleware context is
`{ request, pathname, context, next, handlerType, serverFnMeta }`. The draft did
`new URL(request.url).pathname`; that is unnecessary.

**Returning a `Response` short-circuits the chain.** You do not have to call
`next()`: the handler can return a `Response` directly and neither the
downstream middleware nor the final handler runs.

### CSRF: the trap

```ts
const csrfMiddleware = createCsrfMiddleware({
  filter: (context) => context.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, snapshotMiddleware],
}))
```

TanStack Start installs its default CSRF middleware **only while no
`startInstance` exists**. The internal condition checks whether there is a start
entry, **not** whether that instance supplies `requestMiddleware`. In other
words: **the moment you create `src/start.ts` you lose CSRF**, even if you change
nothing else.

| Situation | Effective `requestMiddleware` |
| --- | --- |
| No `src/start.ts` | `[defaultCsrf]` |
| `createStart(() => ({}))` | `undefined` → **CSRF lost** |
| `createStart(() => ({ requestMiddleware: [mine] }))` | `[mine]` → **CSRF lost** |

That is why we add it back by hand. In development TanStack Start warns on the
console when it is missing; in production it does not.

The middleware runs for SSR, for Server Routes and for Server Functions. Even
though it runs on every request, it almost always ends at the `nextCheckAt`
comparison in memory.

---

## 12. Testing it locally

```bash
docker compose up -d
npm run dev
```

### 11.1. Empty Redis → self-heals

```bash
docker compose exec redis redis-cli FLUSHALL
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
# 200

docker compose exec redis redis-cli HGET "content-island:snapshot" version
# a version string
```

The first request finds nothing in Redis, rebuilds from Content Island and
**repopulates Redis**. The log shows
`[snapshot] Redis is empty, rebuilding from Content Island`.

The same happens if the key is deleted while the app is running: the next check
past the interval rebuilds it.

You only get a `503` when Redis is **unreachable** and the instance has nothing
in memory yet.

### 11.2. Authentication

```bash
curl -i -X POST http://localhost:3000/api/snapshot/refresh
# 401

curl -i -X POST http://localhost:3000/api/snapshot/refresh \
  -H "x-refresh-secret: wrong"
# 401
```

### 11.3. First snapshot

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

Now `/` and `/cars` answer `200`, served from memory.

### 11.4. Inspecting Redis

```bash
docker compose exec redis redis-cli HKEYS "content-island:snapshot"
docker compose exec redis redis-cli HGET  "content-island:snapshot" version
```

The `snapshot` field is binary; do not try to read it from the console.

### 11.5. The diagnostics endpoint

`GET /api/content-island/snapshot-info` compares what **this** instance is
serving against what Redis publishes:

```json
{
  "redisKey": "content-island:snapshot",
  "local":  { "exportedAt": "2026-08-23T14:19:18.216Z", "view": "published", ... },
  "remoteVersion": "2026-08-23T14:19:45.910Z",
  "inSync": false
}
```

`inSync: false` is exactly the **consistency window**: it lasts at most one
`SNAPSHOT_CHECK_INTERVAL_MS`. Seeing it with your own eyes is the best way to
understand the model.

### 11.6. Automatic update

1. Publish a change in Content Island (or simply call the refresh endpoint
   again).
2. Query `/api/content-island/snapshot-info` → `inSync: false`.
3. Wait for the interval (5 s locally) and request any page.
4. Query again → `inSync: true`, and the log shows
   `[snapshot] new version detected`.

---

## 13. What has been verified

| Scenario | Result |
| --- | --- |
| Empty Redis on boot, `GET /` | `200` — rebuilt from Content Island, Redis repopulated |
| Key deleted while running | next check past the interval rebuilds and repopulates |
| Redis unreachable on a cold instance | `503` with `retry-after: 30` |
| `POST /refresh` with no secret / wrong secret | `401`, Redis untouched |
| `POST /refresh` with the right secret | `200`, 408,067 B → 104,292 B |
| `GET /`, `GET /cars` after the refresh | `200` from memory |
| Binary gzip round-trip through Redis | identical bytes, multi-byte UTF-8 intact |
| New version within the interval | `inSync: false`, still serving the old one |
| New version past the interval | detected and adopted on its own |
| Redis down, snapshot in memory | keeps serving `200` |
| Redis down, latency | bounded to 3.06 s; subsequent requests at 41 ms |
| Only `KV_URL` set, no `REDIS_URL` | connects, logs `[redis] using KV_URL` |
| No connection string at all | error naming all three accepted variables |
| Redis restored | checks again and syncs |

---

## 14. Compatibility with Vercel Marketplace Redis

The Marketplace offers two Redis integrations: **Redis Cloud** (official) and
**Upstash**. This project targets **Redis Cloud**, and the code needs no changes
to talk to it — but there are things worth knowing before `02-deploy`.

### What already works

| Point | Why |
| --- | --- |
| Binary values | RESP over TCP is binary-safe: Redis strings are byte sequences. Verified locally — identical bytes, lossless gunzip with multi-byte UTF-8. |
| TLS | node-redis enables TLS purely from the URL scheme (`socket.tls = protocol === 'rediss:'`). A `rediss://` string just works, no configuration. |
| Size | 104 KB compressed. Far below any plan's value or request limit. |
| Key eviction | The Redis Cloud + Vercel integration page states the eviction policy defaults to `no eviction`, so the snapshot key is not dropped under memory pressure. |
| `REDIS_URL` | Redis Cloud injects it for you. The code also accepts `REDIS_TLS_URL` and `KV_URL` as fallbacks. |
| One connection per instance | Fluid compute (on by default since April 2025) shares a single instance across concurrent invocations, and our module-scope state is exactly that shared global. One instance means one TCP connection, not one per request. |

`attachDatabasePool()` from `@vercel/functions` is wired into
`src/server/redis.ts`. It keeps the instance alive long enough to release idle
connections before Vercel suspends it — a suspended instance never fires its own
timers, so its socket would otherwise linger. It is a no-op outside Vercel.

> Its TypeScript type is labelled "Redis (ioredis)", but the runtime detection
> actually duck-types on `options.socket`, which is **node-redis**'s shape.
> Verified against our client.

### The free tier is tighter than it looks

| | Free 30 MB | 250 MB |
| --- | --- | --- |
| Concurrent connections | **30** | 256 |
| Max throughput | **100 ops/s** | 1,000 ops/s |
| Persistence | **No** | Yes |
| TLS | **No** | Yes |

Two consequences worth internalising:

**No TLS on the free plan.** Redis's own docs: *"TLS is not available for Free
Redis Cloud Essentials plans."* Your connection string will be `redis://`, in
the clear over the public internet — password and snapshot included. Fine for a
tutorial, not for anything real.

**100 ops/s is roughly 100 KiB/s.** Our compressed snapshot is 104 KB, so every
cold start consumes about one second of the whole database's bandwidth. This is
precisely why the design polls a tiny `version` field instead of the snapshot:
the expensive transfer only happens when the content actually changed.

For anything beyond a demo, start at the 250 MB tier — it is where TLS,
persistence and a workable connection count begin.

> **If you ever switch to Upstash:** it also speaks TCP (`rediss://`, TLS
> mandatory), but its own docs warn that TCP clients *"can run into connection
> issues"* in serverless, and its recommended `@upstash/redis` client is
> HTTP/JSON and **not binary-safe** — it would corrupt the gzip or force Base64
> (+33 % size). It also does not appear to inject `REDIS_URL`; you would copy the
> TCP URL from its console by hand.

---

## 15. Known limits

**`exportedAt` changes on every export, whether or not you publish.** Two
back-to-back exports with no content change produce different versions
(`14:19:01.116Z` → `14:19:18.216Z`, measured here). Which means: **every call to
the refresh endpoint forces every instance to re-download the whole snapshot**,
even when the content is identical. Do not call refresh "just in case"; call it
when something is published.

**There is no rollback.** The client only adopts a **strictly newer** snapshot
(`incoming.exportedAt <= active.exportedAt` → `unchanged`). If you need to go
back, you have to republish in Content Island, not restore an old snapshot into
Redis.

**A snapshot from another project is rejected.** The client throws when the
incoming snapshot's `projectId` or `view` does not match the active one. That is
good protection, but it means you **cannot share one Redis key between two
Content Island projects** — that is what `CONTENT_ISLAND_PROJECT_ID` is for.

**Consistency window.** With the interval at 5 min, an instance may serve a
previous version for up to 5 min. Lowering it improves freshness and increases
the number of `HGET`s. Only `version` is downloaded, which is a few dozen bytes.

**An empty Redis heals itself; an unreachable one does not.** If the key is
missing — first boot, or a plan without persistence that restarted — the
instance rebuilds straight from Content Island and repopulates Redis. But if
Redis is *unreachable* and the instance has nothing in memory, there is still
nothing to serve: `503`. Note the recovery path has no distributed lock, so
several instances starting at once against an empty Redis will each run their
own `exportSnapshot()`. It is idempotent and the `HSET` is atomic, so the result
is correct — just wasteful. A `SET NX EX` lock is the natural hardening.

**Size.** Snapshots can reach 16 MB. We store `compressedSize` precisely so you
can watch it before hitting your provider's limits.

---

## 16. What is left for `02-deploy`

All of it is done in [`02-deploy`](../02-deploy):

- Managed Redis from the Vercel Marketplace.
- Environment variables on Vercel and a realistic `SNAPSHOT_CHECK_INTERVAL_MS`.
- Initialising the production Redis.
- Content Island webhook → `repository_dispatch` → GitHub Action → refresh
  endpoint.
- A GitHub PAT with the minimum permissions.

---

## 17. References

- [Dynamic Snapshots — overview](https://docs.contentisland.net/dynamic-snapshots/overview/)
- [Snapshot mode in Content Island](https://www.contentisland.net/es/blog/new-spnapshot-mode-content-island/)
- [SSR with Dynamic Snapshot](https://www.contentisland.net/es/blog/content-island-ssr-dynamic-snapshot/)
- [`exportSnapshot`](https://docs.contentisland.net/es/client-api/export-snapshot/)
- [`refreshSnapshot`](https://docs.contentisland.net/es/client-api/refresh-snapshot/)
- [`getSnapshotInfo`](https://docs.contentisland.net/es/client-api/get-snapshot-info/)
- [TanStack Start middleware](https://tanstack.com/start/latest/docs/framework/react/guide/middleware)
- [`HSET`](https://redis.io/docs/latest/commands/hset/) · [node-redis](https://github.com/redis/node-redis)
