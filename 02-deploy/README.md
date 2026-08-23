# 02-deploy — Dynamic Snapshot on Vercel, with managed Redis

*[Versión en español](./README_es.md)*

We start from [`01-local`](../01-local), which already serves all content from
memory with Redis as the source of truth, and take it to production:

- Managed Redis from the Vercel Marketplace.
- Deployment wired to the GitHub repository.
- Production environment variables.
- And automated refresh: when you publish in Content Island, the site finds out
  on its own.

## What does NOT change

**The application code is identical to `01-local`.** Not a single file under
`src/` is touched. Everything in this step is infrastructure and configuration.

The only thing added to the repository is a GitHub Actions workflow, and it goes
in the **repository root**, not in here (see section 7).

---

## 1. Provisioning Redis from the Marketplace

In the Vercel dashboard:

```text
Proyecto  ->  Storage  ->  Create Database
          ->  Marketplace Database Providers
          ->  Redis  ->  Create
```

It will ask for **region**, **high availability** and **plan**. About the region:
pick the one closest to where your functions run, not to where your users are.
Only the server talks to Redis; the browser never does.

Then use **Connect Project** to link it to the project and the environments you
want. That is what injects the credentials as environment variables.

### Billing

Everything goes through Vercel: *"You get a single bill from Vercel"*, and at
*"the same price as going direct"*. Vercel issues the invoice and handles taxes.

Two practical details: each integration has **its own billing cycle and its own
payment method**, independent of your Vercel plan. And **uninstalling the
integration deletes the associated data**.

### The eviction policy

The integration docs state that the default policy is `no eviction`. That is
exactly what we want: if Redis fills up, the write fails instead of silently
dropping the snapshot key.

---

## 2. What the free plan covers

The **Free 30 MB** plan is the one we are going to use. Its limits:

| | Free 30 MB |
| --- | --- |
| Concurrent connections | **30** |
| Max throughput | 100 ops/s |
| Bandwidth | 5 GB/month |
| Persistence | **No** |
| Replication / HA | **No** |
| TLS | **No** |

Three consequences to be clear about before using it:

**No TLS.** Straight from the Redis docs: *"TLS is not available for Free Redis
Cloud Essentials plans."* Your connection string will be `redis://`, in the clear
over the Internet, with the password inside. Our code works either way —node-redis
only enables TLS when the scheme is `rediss://`— but for anything real this is not
good enough.

**No persistence.** If the service restarts, the key is gone. That is not dramatic
here because `01-local` already implemented self-recovery: the instance rebuilds
from Content Island and repopulates Redis by itself. But it does mean Redis is not
a reliable store, it is a shared cache.

**Deleted after 14 days of inactivity.** Redis deletes free databases after
*"14 consecutive days"* without commands. Opening the console **does not count**.
The good news: our version poll every few minutes **is** command traffic, so a
deployed, live app keeps the database awake indefinitely. The real risk is an idle
preview or a development-only database.

### So how far does it go?

Here is the interesting part, and it follows directly from the design of
`01-local`: we poll a tiny version field and only download the snapshot when it
actually changes.

With the measured snapshot (104 KB compressed) and a 5-minute interval:

| Scenario | Usage | Free limit |
| --- | --- | --- |
| 30 instances polling | **0.10 ops/s** | 100 ops/s |
| Polling, bandwidth | **0.02 GB/month** | 5 GB/month |
| 200 publications/month × 30 instances downloading | **0.63 GB/month** | 5 GB/month |

We are using **0.1 % of the operations budget** and around 13 % of the bandwidth
in an already generous scenario.

**The limit that will bite you is connections: 30.** Each Vercel instance holds
one. That is not 30 users or 30 simultaneous requests: it is 30 concurrent
instances, and with Fluid Compute each instance serves many concurrent requests.
Even so, it is the first thing to run out.

### What production would cost

**Redis stopped publishing per-plan prices.** Their page only says `$0` for the
free tier, *"from $5/month"* for Essentials and *"from $0.014/hour"* with
*"Minimum $200/month"* for Pro. The real price depends on cloud, region and high
availability, and **is only visible in the Vercel install dialog** when you pick a
plan. Do not trust blog tables: the ones going around contradict each other.

What is documented is **what you get** when moving from free to the first paid
Essentials plan (250 MB):

| | Free 30 MB | 250 MB |
| --- | --- | --- |
| Connections | 30 | **256** |
| Throughput | 100 ops/s | 1,000 ops/s |
| Bandwidth | 5 GB/month | 100 GB/month |
| Persistence | No | **Yes** (AOF every second) |
| Replication and auto-failover | No | **Yes** |
| TLS | No | **Yes** |

For this use case, the jump to the first paid plan gives you what is really
missing —TLS, persistence and connections to spare— and **you will not need more**:
a 104 KB snapshot is nowhere near the 12 GB where Essentials tops out. The next
step up, Pro, starts at $200/month and adds unlimited connections, VPC and
multi-region: a different league, and not yours.

> **Watch out for replication:** when you enable HA, half the plan goes to the
> replica. A 1 GB plan leaves 512 MB of actual data.

### About the Vercel plan

Hobby is free; Pro is $20/month per seat. Using the Marketplace **requires a card
on file**, even if the resource is free. And remember that Hobby is limited to
**non-commercial** use: if this is for a client, you need Pro regardless of the
database.

### A note on the local Redis

This step ships the same `docker-compose.yml` as `01-local`, with the same
`container_name` and the same port. **You cannot have both up at once**:
`docker compose up -d` from here fails with a name conflict if `01-local`'s
container is running.

To develop locally against this folder the practical option is to **reuse the one
you already have**. The port is the same, so the app connects either way. The only
difference is that `docker compose exec` will not find it (it belongs to the other
Compose project); use `docker exec content-island-redis redis-cli ...` instead.

If you would rather start clean: `docker compose down` in `01-local`, then
`up -d` here.

---

## 3. Deploying from the Vercel UI

1. At [vercel.com/new](https://vercel.com/new), import the GitHub repository.
2. **Root Directory: `02-deploy`.** This is the one thing that cannot go wrong:
   the git repo root is the parent folder, so without this Vercel will not find
   `package.json`.
3. Framework Preset: TanStack Start (detected automatically).
4. Build Command: `npm run build` (the default).
5. Output Directory: **leave it empty**. Nitro writes `.vercel/output` and Vercel
   picks it up on its own. Do not set `.output` or `dist`.
6. Node.js Version: **22.x**.

There is no adapter to install. Nitro detects that it is on Vercel through the
`VERCEL` variable and switches to its preset on its own, producing Build Output
API v3.

From here on, every push to `main` deploys to production and every branch gets its
own preview.

---

## 4. Environment variables

Under **Settings → Environment Variables**:

| Variable | Value | Environments |
| --- | --- | --- |
| `CONTENT_ISLAND_ACCESS_TOKEN` | your token | Production, Preview |
| `SNAPSHOT_REFRESH_SECRET` | `openssl rand -base64 32` | Production, Preview |
| `SNAPSHOT_CHECK_INTERVAL_MS` | `300000` | Production, Preview |
| `CONTENT_ISLAND_PROJECT_ID` | optional | Production, Preview |

**Do not set `REDIS_URL` by hand.** The integration injects it when you connect the
project. Check in the dashboard which name it shows up under; the code accepts
`REDIS_URL`, `REDIS_TLS_URL` and `KV_URL`, in that order.

None of them carry a `VITE_` prefix: they are all server-side and must not reach
the browser.

> After changing environment variables you have to **redeploy** so the deployment
> picks them up.

---

## 5. Seeding production Redis

Thanks to the self-recovery from `01-local`, **you don't have to**: the first
request finds Redis empty, rebuilds from Content Island and repopulates it.

But that first request pays the full cost. If you would rather a real user did not
take the hit, trigger it yourself:

```bash
curl -s -X POST https://TU-DOMINIO/api/snapshot/refresh \
  -H "x-refresh-secret: TU_SECRETO" | jq
```

And check the state:

```bash
curl -s https://TU-DOMINIO/api/content-island/snapshot-info | jq
```

---

## 6. The remaining problem

It works so far, but the refresh is **still called by hand**. You publish in
Content Island and nothing happens until someone fires that `curl`.

What is missing is closing the loop:

```text
Publicas en Content Island
        ↓  webhook
GitHub: repository_dispatch (content-published)
        ↓
GitHub Action: refresh-snapshot.yml
        ↓  POST autenticado
https://TU-DOMINIO/api/snapshot/refresh
        ↓
exportSnapshot() -> gzip -> HSET en Redis
        ↓
Cada instancia detecta la versión nueva en su siguiente sondeo
```

Content Island does not call your endpoint directly: it fires an event on GitHub,
and GitHub Actions acts as the bridge. That way the secret lives in GitHub and not
in the CMS.

---

## 7. The GitHub Actions workflow

**It goes in the repository root**, at `.github/workflows/refresh-snapshot.yml`.

> This is the most common mistake. GitHub **only** reads `.github/workflows/` at
> the repository root. If you put it in `02-deploy/.github/workflows/`, the file is
> inert: no manual run button shows up, and `repository_dispatch` never triggers
> it. And it gives no error: nothing simply happens.

The workflow fires in two ways: `workflow_dispatch` (manual, very handy for seeding
and debugging) and `repository_dispatch` with type `content-published`.

`concurrency` with `cancel-in-progress` prevents refreshes from piling up: if
several publications arrive back to back, the previous run is cancelled and the
last export already carries the most recent state.

### Repository secrets

Under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `REFRESH_URL` | `https://TU-DOMINIO/api/snapshot/refresh` |
| `SNAPSHOT_REFRESH_SECRET` | the same value you set in Vercel |

### Testing it before wiring anything up

The file has to be **on the main branch** for GitHub to show the button. Then:
**Actions → Refresh snapshot → Run workflow**. It should finish green and show
`"status": "updated"`.

Do this before configuring the webhook: that way, if something fails later, you
already know the bridge works and the problem is on the Content Island side.

---

## 8. The GitHub PAT

Content Island needs to authenticate against the GitHub API to create the event.
Use a **fine-grained Personal Access Token**:

```text
GitHub -> Settings -> Developer settings
       -> Personal access tokens -> Fine-grained tokens
       -> Generate new token
```

- Resource owner: the organization that owns the repository.
- Repository access: **only this repository**.
- Repository permissions → **Contents: Read and write**.
- A sensible expiration date.

GitHub requires `Contents: write` to create a `repository_dispatch`. Do not create
a classic token with permissions over everything.

Save the token when GitHub shows it: you cannot see it again afterwards. And if the
organization requires approval for fine-grained tokens, an administrator will have
to approve it.

---

## 9. The webhook in Content Island

In the Content Island project: **Webhook → Add New Webhook → GitHub**.

| Field | Value |
| --- | --- |
| Organization | the one that owns the repository |
| Repository | `dynamic-snapshot-cars-example-vercel` |
| GitHub Token | the fine-grained PAT |
| Event name | `content-published` |

The event name must match the workflow's `types` **exactly**:

```yaml
repository_dispatch:
  types: [content-published]
```

If it does not match, GitHub receives the event and matches it to no workflow at
all. Another silent failure.

---

## 10. Testing it end to end

1. Change something in Content Island and **publish**.
2. In Content Island, check that the webhook fired.
3. In GitHub → Actions, check that the workflow ran and came out green.
4. `GET /api/content-island/snapshot-info`: `remoteVersion` is already the new one
   and `inSync` is `false`.
5. Wait for the interval, reload the site: new content.
6. Check again: `inSync: true`.

No deployment and no rebuild.

---

## 11. Limits and warnings

**The free plan is not for real production.** No TLS, no persistence and 30
connections. It is fine for the tutorial and for a personal project; for anything
real, take the first paid plan.

**The consistency window is still there.** With the interval at 5 minutes, an
instance can serve stale content for up to 5 minutes. That is the price of not
depending on anyone notifying anyone.

**The secret lives in three places** —Vercel, GitHub and your local `.env`— and they
have to match. When you rotate it, rotate it in all three.

**Be careful about who touches the database.** Anyone on the Vercel team who is not
Viewer or Billing can change the Redis configuration from the Redis Cloud console
as if they were Owner.

**The connection limit is consumed by instances, not by users.** If you start
seeing connection errors, look at the number of concurrent instances before you
look at traffic.

---

## 12. References

- [Redis Cloud on the Vercel Marketplace](https://vercel.com/marketplace/redis-cloud)
- [Creating a database with the Vercel integration](https://redis.io/docs/latest/operate/rc/cloud-integrations/vercel/)
- [Essentials plan limits](https://redis.io/docs/latest/operate/rc/subscriptions/view-essentials-subscription/essentials-plan-details/)
- [Persistence](https://redis.io/docs/latest/operate/rc/databases/configuration/data-persistence/) · [TLS](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/) · [High availability](https://redis.io/docs/latest/operate/rc/databases/configuration/high-availability)
- [Free database deletion due to inactivity](https://support.redislabs.com/hc/en-us/articles/33138489404818-Free-Redis-Cloud-Database-Deleted-Due-to-Inactivity)
- [Marketplace billing](https://vercel.com/docs/integrations/create-integration/billing) · [Vercel pricing](https://vercel.com/pricing)
- [TanStack Start on Vercel](https://vercel.com/docs/frameworks/full-stack/tanstack-start)
- [`repository_dispatch`](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#repository_dispatch)
- [Content Island webhooks](https://docs.contentisland.net/es/deployment/github-webhooks/)
