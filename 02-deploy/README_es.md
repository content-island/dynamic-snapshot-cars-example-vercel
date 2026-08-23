# 02-deploy — Dynamic Snapshot en Vercel, con Redis gestionado

*[English version](./README.md)*

Partimos de [`01-local`](../01-local), que ya sirve todo el contenido desde
memoria con Redis como fuente de verdad, y lo llevamos a producción:

- Redis gestionado desde el Marketplace de Vercel.
- Despliegue conectando el repositorio de GitHub.
- Variables de entorno de producción.
- Y automatizamos el refresco: al publicar en Content Island, la web se entera
  sola.

## Lo que NO cambia

**El código de la aplicación es idéntico al de `01-local`.** Ni un fichero de
`src/` se toca. Todo lo de este paso es infraestructura y configuración.

Lo único que se añade al repositorio es un workflow de GitHub Actions, y va en la
**raíz del repositorio**, no aquí dentro (ver sección 7).

---

## 1. Provisionar Redis en el Marketplace

En el panel de Vercel:

```text
Proyecto  ->  Storage  ->  Create Database
          ->  Marketplace Database Providers
          ->  Redis  ->  Create
```

Te pedirá **región**, **alta disponibilidad** y **plan**. Sobre la región: elige
la más cercana a donde corren tus funciones, no a donde están tus usuarios. Solo
el servidor habla con Redis; el navegador nunca.

Después, **Connect Project** para enlazarlo con el proyecto y los entornos que
quieras. Eso es lo que inyecta las credenciales como variables de entorno.

### Facturación

Va todo por Vercel: *"You get a single bill from Vercel"*, y al mismo precio que
contratándolo directamente (*"the same price as going direct"*). Vercel emite la
factura y se encarga de los impuestos.

Dos detalles prácticos: cada integración tiene **su propio ciclo de facturación y
su propio método de pago**, independiente del de tu plan de Vercel. Y
**desinstalar la integración borra los datos** asociados.

### La política de expulsión

La documentación de la integración dice que la política por defecto es
`no eviction`. Es justo lo que queremos: si Redis se llena, falla la escritura en
vez de tirar en silencio la clave del snapshot.

---

## 2. Qué cubre el plan gratuito

El plan **Free de 30 MB** es el que vamos a usar. Sus límites:

| | Free 30 MB |
| --- | --- |
| Conexiones concurrentes | **30** |
| Rendimiento máximo | 100 ops/s |
| Ancho de banda | 5 GB/mes |
| Persistencia | **No** |
| Replicación / HA | **No** |
| TLS | **No** |

Tres consecuencias que hay que tener claras antes de usarlo:

**Sin TLS.** Literal de la documentación de Redis: *"TLS is not available for
Free Redis Cloud Essentials plans."* Tu cadena será `redis://`, en claro por
Internet, con la contraseña dentro. Nuestro código funciona igual —node-redis
activa TLS solo si el esquema es `rediss://`— pero para algo real esto no vale.

**Sin persistencia.** Si el servicio se reinicia, la clave desaparece. Aquí no es
dramático porque `01-local` ya implementó la auto-recuperación: la instancia se
reconstruye desde Content Island y repuebla Redis sola. Pero significa que Redis
no es un almacén fiable, es una caché compartida.

**Se borra por inactividad a los 14 días.** Redis elimina las bases gratuitas tras
*"14 consecutive days"* sin comandos. Entrar en la consola **no cuenta**. La buena
noticia: nuestro sondeo de versión cada pocos minutos **es** tráfico de comandos,
así que una app desplegada y con vida mantiene la base despierta indefinidamente.
El riesgo real es un preview parado o una base de solo desarrollo.

### ¿Y cuánto aguanta?

Aquí está lo interesante, y es consecuencia directa del diseño de `01-local`:
sondeamos un campo de versión diminuto y solo descargamos el snapshot cuando
cambia de verdad.

Con el snapshot medido (104 KB comprimidos) y un intervalo de 5 minutos:

| Escenario | Consumo | Límite gratuito |
| --- | --- | --- |
| 30 instancias sondeando | **0,10 ops/s** | 100 ops/s |
| Sondeos, ancho de banda | **0,02 GB/mes** | 5 GB/mes |
| 200 publicaciones/mes × 30 instancias descargando | **0,63 GB/mes** | 5 GB/mes |

Estamos usando el **0,1 % del presupuesto de operaciones** y alrededor del 13 %
del ancho de banda en un escenario ya generoso.

**El límite que te va a morder es el de conexiones: 30.** Cada instancia de
Vercel mantiene una. No son 30 usuarios ni 30 peticiones a la vez: son 30
instancias simultáneas, y con Fluid Compute cada instancia atiende muchas
peticiones concurrentes. Aun así, es lo primero que se agota.

### Qué costaría producción

**Redis dejó de publicar los precios por plan.** Su página solo dice `$0` para el
gratuito, *"from $5/month"* para Essentials y *"from $0.014/hour"* con
*"Minimum $200/month"* para Pro. El precio real depende de nube, región y alta
disponibilidad, y **solo se ve en el diálogo de instalación de Vercel** al elegir
plan. No te fíes de tablas de blogs: las que circulan se contradicen entre sí.

Lo que sí está documentado es **qué te llevas** al pasar del gratuito al primer
plan de pago de Essentials (250 MB):

| | Free 30 MB | 250 MB |
| --- | --- | --- |
| Conexiones | 30 | **256** |
| Rendimiento | 100 ops/s | 1 000 ops/s |
| Ancho de banda | 5 GB/mes | 100 GB/mes |
| Persistencia | No | **Sí** (AOF cada segundo) |
| Replicación y auto-failover | No | **Sí** |
| TLS | No | **Sí** |

Para este caso de uso, el salto al primer plan de pago te da lo que de verdad
falta —TLS, persistencia y conexiones de sobra— y **no vas a necesitar más**: un
snapshot de 104 KB no se acerca ni de lejos a los 12 GB donde termina Essentials.
El siguiente escalón, Pro, empieza en 200 $/mes y añade conexiones ilimitadas,
VPC y multi-región: otra liga, y no la tuya.

> **Ojo con la replicación:** cuando actives HA, la mitad del plan se va a la
> réplica. Un plan de 1 GB deja 512 MB de datos reales.

### Sobre el plan de Vercel

Hobby es gratis; Pro son 20 $/mes por asiento. Para usar el Marketplace **hace
falta una tarjeta registrada**, aunque el recurso sea gratuito. Y recuerda que
Hobby está limitado a uso **no comercial**: si esto es de un cliente, necesitas
Pro independientemente de la base de datos.

### Un aviso sobre el Redis local

Este paso trae el mismo `docker-compose.yml` que `01-local`, con el mismo
`container_name` y el mismo puerto. **No puedes tener los dos levantados a la
vez**: `docker compose up -d` desde aquí falla con un conflicto de nombre si el
de `01-local` está corriendo.

Para desarrollar en local sobre esta carpeta, lo más práctico es **reutilizar el
que ya tienes**. El puerto es el mismo, así que la aplicación conecta igual. Lo
único que cambia es que `docker compose exec` no lo encuentra (pertenece al otro
proyecto de Compose); usa `docker exec content-island-redis redis-cli ...`.

Si prefieres empezar limpio: `docker compose down` en `01-local` y `up -d` aquí.

---

## 3. Desplegar desde la UI de Vercel

1. En [vercel.com/new](https://vercel.com/new), importa el repositorio de GitHub.
2. **Root Directory: `02-deploy`.** Es lo único que no puede fallar: la raíz del
   repo git es la carpeta padre, así que sin esto Vercel no encuentra el
   `package.json`.
3. Framework Preset: TanStack Start (lo detecta solo).
4. Build Command: `npm run build` (el de por defecto).
5. Output Directory: **déjalo vacío**. Nitro escribe `.vercel/output` y Vercel lo
   reconoce solo. No pongas `.output` ni `dist`.
6. Node.js Version: **22.x**.

No hay adaptador que instalar. Nitro detecta que está en Vercel por la variable
`VERCEL` y conmuta solo a su preset, generando Build Output API v3.

A partir de aquí, cada push a `main` despliega a producción y cada rama tiene su
preview.

---

## 4. Variables de entorno

En **Settings → Environment Variables**:

| Variable | Valor | Entornos |
| --- | --- | --- |
| `CONTENT_ISLAND_ACCESS_TOKEN` | tu token | Production, Preview |
| `SNAPSHOT_REFRESH_SECRET` | `openssl rand -base64 32` | Production, Preview |
| `SNAPSHOT_CHECK_INTERVAL_MS` | `300000` | Production, Preview |
| `CONTENT_ISLAND_PROJECT_ID` | opcional | Production, Preview |

**`REDIS_URL` no la pongas a mano.** La inyecta la integración al conectar el
proyecto. Comprueba en el panel con qué nombre aparece; el código acepta
`REDIS_URL`, `REDIS_TLS_URL` y `KV_URL`, en ese orden.

Ninguna lleva prefijo `VITE_`: todas son de servidor y no deben llegar al
navegador.

> Después de cambiar variables de entorno hay que **volver a desplegar** para que
> el despliegue las recoja.

---

## 5. Inicializar el Redis de producción

Gracias a la auto-recuperación de `01-local`, **no hace falta**: la primera
petición encuentra Redis vacío, se reconstruye desde Content Island y lo repuebla.

Pero esa primera petición paga el coste completo. Si prefieres que no le toque a
un usuario real, dispáralo tú:

```bash
curl -s -X POST https://TU-DOMINIO/api/snapshot/refresh \
  -H "x-refresh-secret: TU_SECRETO" | jq
```

Y comprueba el estado:

```bash
curl -s https://TU-DOMINIO/api/content-island/snapshot-info | jq
```

---

## 6. El problema que queda

Hasta aquí funciona, pero el refresco **se sigue llamando a mano**. Publicas en
Content Island y no pasa nada hasta que alguien lanza ese `curl`.

Lo que falta es cerrar el círculo:

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

Content Island no llama a tu endpoint directamente: dispara un evento en GitHub,
y GitHub Actions hace de puente. Así el secreto vive en GitHub y no en el CMS.

---

## 7. El workflow de GitHub Actions

**Va en la raíz del repositorio**, en `.github/workflows/refresh-snapshot.yml`.

> Esto es lo que más se falla. GitHub **solo** lee `.github/workflows/` en la raíz
> del repositorio. Si lo pones en `02-deploy/.github/workflows/`, el fichero es
> inerte: ni sale el botón de ejecución manual, ni el `repository_dispatch` lo
> activa nunca. Y no da ningún error: simplemente no ocurre nada.

El workflow se dispara de dos formas: `workflow_dispatch` (a mano, muy útil para
inicializar y depurar) y `repository_dispatch` con el tipo `content-published`.

`concurrency` con `cancel-in-progress` evita acumular refrescos: si llegan varias
publicaciones seguidas, se cancela la anterior y la última exportación ya se lleva
el estado más reciente.

### Secretos del repositorio

En **Settings → Secrets and variables → Actions**:

| Secreto | Valor |
| --- | --- |
| `REFRESH_URL` | `https://TU-DOMINIO/api/snapshot/refresh` |
| `SNAPSHOT_REFRESH_SECRET` | el mismo valor que pusiste en Vercel |

### Probarlo antes de conectar nada

El fichero tiene que estar **en la rama principal** para que GitHub muestre el
botón. Luego: **Actions → Refresh snapshot → Run workflow**. Debe terminar en
verde y mostrar `"status": "updated"`.

Hazlo antes de configurar el webhook: así, si algo falla después, ya sabes que el
puente funciona y el problema está en Content Island.

---

## 8. El PAT de GitHub

Content Island necesita autenticarse contra la API de GitHub para crear el evento.
Usa un **fine-grained Personal Access Token**:

```text
GitHub -> Settings -> Developer settings
       -> Personal access tokens -> Fine-grained tokens
       -> Generate new token
```

- Resource owner: la organización dueña del repositorio.
- Repository access: **solo este repositorio**.
- Repository permissions → **Contents: Read and write**.
- Fecha de expiración razonable.

GitHub exige `Contents: write` para crear un `repository_dispatch`. No hagas un
token clásico con permisos sobre todo.

Guarda el token cuando GitHub lo enseñe: después no se puede volver a ver. Y si la
organización exige aprobación para los fine-grained, un administrador tendrá que
aprobarlo.

---

## 9. El webhook en Content Island

En el proyecto de Content Island: **Webhook → Add New Webhook → GitHub**.

| Campo | Valor |
| --- | --- |
| Organización | la dueña del repositorio |
| Repositorio | `dynamic-snapshot-cars-example-vercel` |
| GitHub Token | el fine-grained PAT |
| Nombre del evento | `content-published` |

El nombre del evento debe coincidir **exactamente** con el `types` del workflow:

```yaml
repository_dispatch:
  types: [content-published]
```

Si no coincide, GitHub recibe el evento y no lo hace corresponder con ningún
workflow. Otro fallo silencioso.

---

## 10. Probarlo de punta a punta

1. Cambia algo en Content Island y **publica**.
2. En Content Island, comprueba que el webhook se ha disparado.
3. En GitHub → Actions, que el workflow ha corrido y ha salido verde.
4. `GET /api/content-island/snapshot-info`: `remoteVersion` ya es la nueva y
   `inSync` está en `false`.
5. Espera el intervalo, recarga la web: contenido nuevo.
6. Vuelve a consultar: `inSync: true`.

Sin desplegar y sin reconstruir nada.

---

## 11. Límites y avisos

**El plan gratuito no es para producción de verdad.** Sin TLS, sin persistencia y
30 conexiones. Sirve para el tutorial y para un proyecto personal; para algo real,
el primer plan de pago.

**La ventana de consistencia sigue existiendo.** Con el intervalo a 5 minutos, una
instancia puede servir hasta 5 minutos contenido anterior. Es el precio de no
depender de que nadie avise a nadie.

**El secreto vive en tres sitios** —Vercel, GitHub y tu `.env` local— y tienen que
coincidir. Cuando lo rotes, rótalo en los tres.

**Cuidado con quién toca la base.** Cualquiera del equipo de Vercel que no sea
Viewer o Billing puede cambiar la configuración de Redis desde la consola de Redis
Cloud como si fuera Owner.

**El límite de conexiones se agota por instancias, no por usuarios.** Si empiezas
a ver errores de conexión, mira el número de instancias concurrentes antes que el
tráfico.

---

## 12. Referencias

- [Redis Cloud en el Marketplace de Vercel](https://vercel.com/marketplace/redis-cloud)
- [Crear una base con la integración de Vercel](https://redis.io/docs/latest/operate/rc/cloud-integrations/vercel/)
- [Límites de los planes Essentials](https://redis.io/docs/latest/operate/rc/subscriptions/view-essentials-subscription/essentials-plan-details/)
- [Persistencia](https://redis.io/docs/latest/operate/rc/databases/configuration/data-persistence/) · [TLS](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/) · [Alta disponibilidad](https://redis.io/docs/latest/operate/rc/databases/configuration/high-availability)
- [Borrado de bases gratuitas por inactividad](https://support.redislabs.com/hc/en-us/articles/33138489404818-Free-Redis-Cloud-Database-Deleted-Due-to-Inactivity)
- [Facturación del Marketplace](https://vercel.com/docs/integrations/create-integration/billing) · [Precios de Vercel](https://vercel.com/pricing)
- [TanStack Start en Vercel](https://vercel.com/docs/frameworks/full-stack/tanstack-start)
- [`repository_dispatch`](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#repository_dispatch)
- [Webhooks de Content Island](https://docs.contentisland.net/es/deployment/github-webhooks/)
