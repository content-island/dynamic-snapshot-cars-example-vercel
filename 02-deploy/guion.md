# Guion de vídeo · 02-deploy · Llevarlo a producción en Vercel

> Documento de rodaje. La referencia técnica está en [`README_es.md`](./README_es.md).
>
> **Convenciones:** *Dices* es texto para narrar. *En pantalla* es lo que se ve.
> *Ojo* son notas para ti, no se dicen.

---

## Antes de grabar

Este vídeo es casi todo panel web, así que la preparación es distinta a la del anterior.

**Cuentas y accesos abiertos, en pestañas separadas:**

- Vercel, logueado, con el repo ya subido a GitHub pero **sin importar todavía**.
- GitHub, en el repositorio.
- Content Island, en el proyecto.

**Decisiones tomadas de antemano** (dudar en cámara en un panel se nota mucho):

- La región de Redis que vas a elegir.
- Qué campo de qué coche vas a cambiar en la demo final.

**Genera el secreto antes y tenlo copiado:**

```bash
openssl rand -base64 32
```

**Ojo con lo que se ve en pantalla.** Este vídeo enseña paneles con secretos de
verdad. Antes de grabar decide cómo tapas: el token de Content Island, la
`REDIS_URL` con su contraseña, el `SNAPSHOT_REFRESH_SECRET` y el PAT de GitHub.
Lo más limpio es usar valores de usar y tirar y **rotarlos al terminar de grabar**.
Si no, te toca censurar en edición y siempre se escapa algo.

**Ojo — el Redis local:** esta carpeta trae el mismo `docker-compose.yml` que
`01-local`, con el mismo nombre de contenedor y el mismo puerto. **No puedes tener
los dos a la vez.** Si vas a enseñar algo en local, reutiliza el que ya tienes
corriendo (la app conecta igual) y usa `docker exec content-island-redis` en lugar
de `docker compose exec`, que no lo encuentra por pertenecer al otro proyecto.
En este vídeo casi todo es producción, así que apenas lo vas a necesitar.

**Ojo:** para la demo final, pon `SNAPSHOT_CHECK_INTERVAL_MS` a **30000** en
Vercel. Con 300000 son cinco minutos de silencio en cámara; con 30 segundos se ve
y sigue siendo un valor defendible.

---

## Ficha del vídeo

**Duración estimada:** 32–36 min.

| # | Bloque | Aprox. |
| --- | --- | --- |
| 0 | De dónde venimos | 2 min |
| 1 | Provisionar Redis en el Marketplace | 4 min |
| 2 | Cuánto cuesta y cuánto aguanta | 5 min |
| 3 | Desplegar desde la UI | 4 min |
| 4 | Las variables de entorno | 3 min |
| 5 | Primera carga en producción | 3 min |
| 6 | Lo que todavía falta | 2 min |
| 7 | El PAT de GitHub | 3 min |
| 8 | La GitHub Action | 4 min |
| 9 | El webhook en Content Island | 3 min |
| 10 | Demo final | 3 min |
| 11 | Cierre | 1 min |

---

## Bloque 0 · De dónde venimos · ~2 min

**En pantalla:** la app corriendo en local, con Docker y `npm run dev`.

**Dices:**

> En el vídeo anterior montamos esto: una web que sirve todo su contenido desde
> memoria, con Redis guardando cuál es la versión vigente y cada instancia
> comprobándolo por su cuenta.
>
> Pero corría en mi portátil, con un Redis en Docker. Hoy lo llevamos a
> producción de verdad.

**En pantalla:** el árbol de carpetas, `01-local` y `02-deploy` al lado.

**Dices:**

> He copiado el proyecto tal cual a la carpeta `02-deploy`. Y fíjate en una cosa,
> porque es importante: **el código no va a cambiar**. Ni un fichero de `src`.
>
> Todo lo de hoy es infraestructura y configuración. Que ya es bastante, porque
> vamos a ver cuatro cosas: provisionar un Redis gestionado, desplegar, cuánto
> cuesta esto de verdad, y automatizar el refresco para dejar de llamarlo a mano.

**Ojo:** si el vídeo anterior lo vio poca gente, aquí van bien 20 segundos de
recordatorio del diagrama. Si no, sigue.

---

## Bloque 1 · Provisionar Redis en el Marketplace · ~4 min

**En pantalla:** panel de Vercel → pestaña **Storage**.

**Dices:**

> Primero Redis, porque sin él la aplicación no arranca.
>
> Vercel tiene un Marketplace de bases de datos. Tú lo provisionas desde aquí, y
> te lo cobran en tu factura de Vercel, sin abrir cuenta en otro sitio ni tener dos
> facturas. Y al mismo precio que si lo contrataras directamente.

**En pantalla:**

```text
Storage -> Create Database -> Marketplace Database Providers -> Redis -> Create
```

**Dices:**

> Elegimos Redis, el oficial, el de los creadores de Redis. Y aquí nos pide tres
> cosas: región, alta disponibilidad y plan.

**En pantalla:** el selector de región.

**Dices:**

> Sobre la región, un apunte que se falla mucho: elige la más cercana a **donde
> corren tus funciones**, no a donde están tus usuarios. El navegador no habla con
> Redis nunca. Solo tu servidor. Así que lo que importa es esa latencia.

**En pantalla:** el selector de plan. Eliges **Free, 30 MB**.

**Dices:**

> Y de plan cojo el gratuito, de treinta megas. Que para nuestro snapshot de cien
> kilobytes va sobradísimo. Ahora vemos qué implica y qué costaría lo siguiente.

**En pantalla:** **Connect Project**, eliges el proyecto y los entornos.

**Dices:**

> Y esto es lo que de verdad hace la magia: conectar el recurso al proyecto. Eso
> es lo que inyecta las credenciales como variables de entorno, sin que yo tenga
> que copiar y pegar una cadena de conexión a ningún sitio.

**Ojo:** aquí es donde se ve la `REDIS_URL` con la contraseña. Tápala o rota
luego.

**Dices:**

> Y un detalle que nos viene de perlas: la política de expulsión de claves viene
> por defecto en `no eviction`. O sea, si Redis se llenara, fallaría la escritura
> en vez de tirar en silencio nuestra clave del snapshot. Que es exactamente lo
> que queremos para algo que es la fuente de la verdad.

---

## Bloque 2 · Cuánto cuesta y cuánto aguanta · ~5 min

**Ojo:** este bloque es el que más valor da al espectador y el que nadie hace.
Casi todos los tutoriales enseñan a provisionar y no dicen qué pasa cuando
crezcas. No lo corras.

**En pantalla:** la tabla de límites del plan gratuito.

**Dices:**

> Vamos con la pregunta que siempre queda sin responder: ¿esto cuánto aguanta y
> qué me va a costar el día que crezca?
>
> El plan gratuito son treinta megas, treinta conexiones concurrentes, cien
> operaciones por segundo y cinco gigas de tráfico al mes.

**Dices, marcando:**

> Y tiene tres cosas que **no** tiene, y que hay que saber.
>
> No tiene TLS. Lo dice la documentación de Redis tal cual: TLS no está
> disponible en el plan gratuito. O sea, tu conexión va en claro por Internet, con
> la contraseña dentro. Funciona, pero para algo serio no vale.
>
> No tiene persistencia. Si el servicio se reinicia, la clave desaparece.
>
> Y se borra por inactividad a los catorce días sin recibir comandos. Ojo, que
> entrar en la consola no cuenta.

**Dices:**

> Ahora, fíjate qué bien encaja esto con lo que montamos en el vídeo anterior.
>
> ¿Que se pierde la clave porque no hay persistencia? Da igual: implementamos la
> auto-recuperación. La instancia lo detecta, se lo pide a Content Island y
> repuebla Redis sola.
>
> ¿Que se borra por inactividad? No va a pasar: nuestro sondeo de versión cada
> pocos minutos **es** tráfico de comandos. Una app viva mantiene la base
> despierta ella sola.

**En pantalla:** la tabla de consumo real.

**Dices:**

> Y ahora los números, que es lo que te interesa. Con nuestro snapshot de ciento
> cuatro kilobytes y un intervalo de cinco minutos:
>
> Treinta instancias sondeando dan **una décima de operación por segundo**. El
> límite son cien. Estamos usando el cero coma uno por ciento.
>
> Y en tráfico: doscientas publicaciones al mes, con treinta instancias
> descargándose el snapshot cada vez, son **seis décimas de giga**. De cinco.
>
> Y esto no es suerte. Es exactamente por lo que en el vídeo anterior sondeábamos
> un campito de versión en vez de bajarnos el snapshot entero cada vez.

**Dices:**

> ¿Qué es entonces lo que se te va a agotar primero? **Las conexiones.** Treinta.
> Y ojo, que no son treinta usuarios ni treinta peticiones a la vez: son treinta
> **instancias** simultáneas, y cada instancia con Fluid Compute atiende un
> montón de peticiones concurrentes. Pero es lo primero que se acaba.

**En pantalla:** la comparativa Free contra 250 MB.

**Dices:**

> ¿Y cuánto cuesta el siguiente escalón? Aquí te tengo que ser honesto: **Redis ha
> dejado de publicar los precios por plan**. Su página solo dice "desde cinco
> dólares al mes" para Essentials. El precio real depende de la nube, la región y
> si pones alta disponibilidad, y solo lo ves en el diálogo de Vercel al elegir
> plan.
>
> Hay tablas por ahí en blogs, pero se contradicen entre ellas. Así que no te doy
> un número que no puedo respaldar. Míralo en el selector, que lo tienes delante.

**Dices:**

> Lo que sí está documentado es **qué te llevas** por ese primer plan de pago, el
> de doscientos cincuenta megas: TLS, persistencia, replicación con auto-failover,
> y las conexiones pasan de treinta a doscientas cincuenta y seis.
>
> Y te digo algo que casi nunca oirás en un tutorial: para este caso de uso, con
> ese primer plan de pago **ya has terminado**. Un snapshot de cien kilobytes no
> se acerca ni de lejos a los doce gigas donde acaba Essentials. El siguiente
> escalón, Pro, arranca en doscientos dólares al mes. Eso es otra liga, y no es la
> tuya.

**Ojo (aviso útil):** si activas alta disponibilidad, **la mitad del plan se va a
la réplica**. Un plan de 1 GB deja 512 MB reales. Sorprende a mucha gente.

---

## Bloque 3 · Desplegar desde la UI · ~4 min

**En pantalla:** [vercel.com/new](https://vercel.com/new), importas el repo.

**Dices:**

> Ahora el despliegue. Y va a ser sospechosamente fácil.

**En pantalla:** la pantalla de configuración del proyecto.

**Dices:**

> Importo el repositorio de GitHub y... aquí está lo único que no puede fallar.

**En pantalla:** señalas **Root Directory** y pones `02-deploy`.

**Dices:**

> **Root Directory: `02-deploy`.** Porque en este repo la raíz de git es la
> carpeta de arriba, la que tiene el `00-start`, el `01-local` y el `02-deploy`.
> Si no le dices esto, Vercel busca un `package.json` en la raíz, no lo encuentra
> y no hay manera.

**Dices:**

> El resto lo detecta solo. El framework lo reconoce, el comando de build es
> `npm run build`, y el directorio de salida **lo dejas vacío**. No pongas
> `.output` ni `dist`, que es la tentación. Nitro escribe en `.vercel/output` y
> Vercel lo reconoce sin ayuda.
>
> Y la versión de Node, la 22.

**Dices:**

> Otra cosa que no hay que hacer: **no hay ningún adaptador que instalar**. Nitro
> mira si está corriendo dentro de Vercel, ve la variable de entorno, y conmuta
> solo. Cero configuración.

**En pantalla:** el build fallando o la web dando error.

**Dices:**

> Lo despliego... y no funciona. Y está bien que no funcione, porque nos faltan
> las variables de entorno. Vamos.

**Ojo:** si el primer despliegue te sale bien por alguna razón, no finjas que
falla. Salta al bloque 4 diciendo «faltan las variables, vamos a por ellas».

---

## Bloque 4 · Las variables de entorno · ~3 min

**En pantalla:** Settings → Environment Variables.

**Dices:**

> Cuatro variables. Ninguna lleva prefijo `VITE_`, y eso es a propósito: todas son
> de servidor y ninguna puede llegar al navegador.

**En pantalla:** las vas añadiendo.

```text
CONTENT_ISLAND_ACCESS_TOKEN   tu token
SNAPSHOT_REFRESH_SECRET       el que generaste con openssl
SNAPSHOT_CHECK_INTERVAL_MS    30000
CONTENT_ISLAND_PROJECT_ID     (opcional)
```

**Dices:**

> El token de Content Island. El secreto del endpoint de refresco, que ya lo tenía
> generado. El intervalo, que para el vídeo lo pongo en treinta segundos para no
> tener tiempos muertos; en producción de verdad, cinco minutos.

**En pantalla:** buscas `REDIS_URL` en la lista y **ya está ahí**.

**Dices:**

> Y fíjate: la `REDIS_URL` **no la pongo yo**. Ya está, la metió la integración
> cuando conecté el proyecto.
>
> Y aquí hay un detalle del código que hicimos en el vídeo anterior que ahora
> cobra sentido. ¿Te acuerdas de que aceptábamos tres nombres, `REDIS_URL`,
> `REDIS_TLS_URL` y `KV_URL`? Es por esto. Cada proveedor la inyecta con el suyo,
> y así cambiar de proveedor es configuración y no tocar código.

**Ojo:** tapa el valor de `REDIS_URL`, que lleva la contraseña.

**Dices:**

> Y una cosa que se olvida siempre: después de tocar variables de entorno hay que
> **volver a desplegar**. El despliegue que ya existe no las recoge solo.

**En pantalla:** Redeploy.

---

## Bloque 5 · Primera carga en producción · ~3 min

**En pantalla:** abres la URL de producción. Carga.

**Dices:**

> Y ahí está, en producción.
>
> Pero para un segundo a pensar qué acaba de pasar, porque tiene su gracia. Ese
> Redis está **completamente vacío**. Nadie ha metido nada todavía.

**En pantalla:** el endpoint de diagnóstico.

```bash
curl -s https://TU-DOMINIO/api/content-island/snapshot-info | jq
```

**Dices:**

> Y sin embargo la web funciona y aquí tengo una versión. ¿Por qué? Porque la
> primera instancia encontró Redis vacío, se lo pidió directamente a Content
> Island y de paso lo dejó preparado para las siguientes.
>
> Eso es la auto-recuperación que montamos en el vídeo anterior, funcionando en
> producción. Y es justo lo que compensa que el plan gratuito no tenga
> persistencia.

**Dices:**

> Si prefieres que ese primer coste no le toque a un usuario real, lo disparas tú
> antes de abrir el sitio:

```bash
curl -s -X POST https://TU-DOMINIO/api/snapshot/refresh \
  -H "x-refresh-secret: TU_SECRETO" | jq
```

**En pantalla:** los logs de la función en Vercel, con el `[snapshot]`.

**Ojo:** enseña los logs unos segundos. Ver los mismos mensajes que en local, pero
en producción, cierra el círculo mentalmente para el espectador.

---

## Bloque 6 · Lo que todavía falta · ~2 min

**En pantalla:** partes la pantalla: Content Island y la web.

**Dices:**

> Vale, está desplegado. Vamos a probar lo que vinimos a hacer: cambio un precio
> en Content Island, publico... y me voy a la web.

**En pantalla:** recargas. **No ha cambiado nada.**

**Dices:**

> Y no pasa nada. Absolutamente nada.
>
> Porque el refresco lo seguimos llamando **a mano**. Content Island no sabe que
> existe nuestro endpoint, y nuestro endpoint no sabe que se ha publicado nada.

**En pantalla:** el diagrama del circuito que falta.

**Dices:**

> Lo que falta es cerrar el círculo. Y el camino es este: cuando publicas, Content
> Island dispara un evento en GitHub. GitHub Actions lo recoge y hace de puente:
> llama a nuestro endpoint con el secreto.
>
> ¿Y por qué dando esa vuelta, en vez de que Content Island llame directamente?
> Por dos razones. Una, que así el secreto vive en GitHub, que es donde ya guardas
> tus secretos, y no en el CMS. Y dos, que te queda un historial de ejecuciones
> con sus logs para cuando algo falle.

---

## Bloque 7 · El PAT de GitHub · ~3 min

**En pantalla:** GitHub → Settings → Developer settings → Fine-grained tokens.

**Dices:**

> Para que Content Island pueda disparar ese evento necesita autenticarse contra
> la API de GitHub. Y aquí, por favor, **token de grano fino**, no uno clásico.

**En pantalla:** configuras el token.

**Dices:**

> Resource owner: la organización dueña del repo. Repository access: **solo este
> repositorio**, no todos. Y en permisos: **Contents, read and write**.
>
> Ese `write` chirría, lo sé, para algo que solo dispara un evento. Pero es lo que
> exige GitHub para crear un `repository_dispatch`. Lo que sí puedes controlar es
> el alcance: un repositorio, y con fecha de caducidad.

**Ojo:** aquí sale el token en pantalla. Tápalo, o usa uno de usar y tirar y
revócalo al acabar de grabar. Dilo en voz alta, que educa.

**Dices:**

> Y cópialo ahora, porque GitHub no te lo vuelve a enseñar nunca.

---

## Bloque 8 · La GitHub Action · ~4 min

**En pantalla:** creas el fichero en el editor.

**`.github/workflows/refresh-snapshot.yml`** · nuevo · **en la RAÍZ del repositorio**

**Dices:**

> Y aquí está el fallo que te va a costar media tarde si no lo sabes, así que
> presta atención a la ruta.
>
> Este fichero va en la **raíz del repositorio**. No dentro de `02-deploy`.
> GitHub solo mira `.github/workflows` en la raíz.
>
> Y lo peor es cómo falla: **no falla**. No hay error, no hay aviso. Simplemente
> el workflow no existe para GitHub. No te sale el botón de ejecutar, y el evento
> no dispara nada. Y te vuelves loco mirando el webhook, que está perfecto.

**En pantalla:** el contenido del fichero, señalando las partes.

**Dices:**

> Dos disparadores. `workflow_dispatch`, que es el botón de ejecutar a mano, y que
> vale oro para inicializar y para depurar. Y `repository_dispatch` con el tipo
> `content-published`, que es el que va a usar Content Island.
>
> Y el bloque de `concurrency`, que evita acumular refrescos: si llegan tres
> publicaciones seguidas, cancela las anteriores. Y no perdemos nada, porque la
> última exportación ya se lleva el estado más reciente de todas formas.

**En pantalla:** GitHub → Settings → Secrets and variables → Actions.

**Dices:**

> Dos secretos en el repositorio: la URL de nuestro endpoint, y el mismo secreto
> que pusimos en Vercel. El mismo. Que ahora vive en tres sitios: tu `.env` local,
> Vercel y GitHub. Cuando lo rotes, acuérdate de los tres.

**En pantalla:** Actions → Refresh snapshot → **Run workflow**.

**Dices:**

> Y lo pruebo a mano antes de conectar nada más. Esto es importante como método:
> si pruebo el puente ahora y funciona, cuando conecte el webhook y algo falle, ya
> sé que el problema está en Content Island y no aquí.

**En pantalla:** el workflow en verde, con `"status": "updated"` en el log.

**Ojo:** el fichero tiene que estar **en la rama principal** para que aparezca el
botón. Si no lo ves, es eso.

---

## Bloque 9 · El webhook en Content Island · ~3 min

**En pantalla:** Content Island → proyecto → Webhook → Add New Webhook → GitHub.

**Dices:**

> Y la última pieza. En Content Island, en el proyecto, añadimos un webhook de
> tipo GitHub.

**En pantalla:** rellenas los campos.

```text
Organización       la dueña del repositorio
Repositorio        dynamic-snapshot-cars-example-vercel
GitHub Token       el PAT de antes
Nombre del evento  content-published
```

**Dices, marcando:**

> Y aquí el segundo fallo silencioso del vídeo: **el nombre del evento tiene que
> coincidir exactamente** con el que pusimos en el workflow.
>
> `content-published`. Igual, letra por letra.
>
> Si no coincide, GitHub recibe el evento perfectamente, no da ningún error... y
> no lo hace corresponder con ningún workflow. Todo verde, y no pasa nada.

**En pantalla:** los dos ficheros lado a lado — el webhook y el `types` del YAML.

**Ojo:** enséñalos juntos unos segundos. Es un detalle que se entiende en un
vistazo y se sufre durante una tarde.

---

## Bloque 10 · Demo final · ~3 min

**Ojo:** ensáyala una vez. Es el pago de los dos vídeos.

**En pantalla:** cuatro cosas visibles si puedes: Content Island, la web, GitHub
Actions y una terminal.

**Dices:**

> Y ahora sí. Vamos a hacer lo mismo que en el bloque seis, cuando no pasaba nada.

**En pantalla:** cambias el precio en Content Island y **publicas**.

**Dices:**

> Publico. Y me voy a GitHub sin tocar nada más.

**En pantalla:** en Actions aparece una ejecución nueva, sola.

**Dices:**

> Ahí está. Se ha disparado solo. Content Island ha creado el evento, GitHub lo ha
> recogido y está llamando a nuestro endpoint.

**En pantalla:** el workflow en verde con la respuesta.

**Terminal**

```bash
curl -s https://TU-DOMINIO/api/content-island/snapshot-info \
  | jq '{local: .local.exportedAt, remoto: .remoteVersion, inSync}'
```

**Dices:**

> Y aquí está otra vez nuestra ventana de consistencia. Redis ya tiene la versión
> nueva, y esta instancia todavía sirve la anterior. `inSync: false`.

**En pantalla:** esperas el intervalo, recargas la web. **Precio nuevo.**

**Dices:**

> Y ya está. Contenido nuevo en producción, sin desplegar y sin reconstruir nada.
> Desde que le di a publicar hasta que se vio, no toqué absolutamente nada.

---

## Bloque 11 · Cierre · ~1 min

**Dices:**

> Recapitulando los dos vídeos.
>
> Tenemos una web que sirve todo su contenido desde memoria, sin llamadas de red.
> Redis gestionado guarda cuál es la versión vigente, y cada instancia de Vercel
> se entera por su cuenta, sin depender de que nadie la avise ni de estar viva en
> el momento justo. Publicar contenido no requiere ni desplegar ni reconstruir.
>
> Y el código de la aplicación está exactamente igual que cuando empezamos. Todo
> lo de hoy ha sido configuración.
>
> Si esto te ha servido, tienes el repositorio completo en la descripción, con los
> tres pasos separados por carpetas para que puedas ir viendo qué cambia en cada
> uno.
>
> Nos vemos.

---

## Apéndice · Preguntas que te van a hacer

**«¿Puedo hacer esto en el plan Hobby de Vercel?»**
Para usar el Marketplace hace falta una tarjeta registrada, aunque el recurso sea
gratuito. Y Hobby está limitado a uso no comercial: si es de un cliente,
necesitas Pro.

**«¿Y si no uso GitHub?»**
El puente puede ser cualquier cosa que sepa hacer un POST autenticado: una Action,
un cron de Vercel, una función de otro sitio. GitHub Actions es cómodo porque ya
tienes ahí los secretos y te deja historial.

**«¿Por qué no llamar al endpoint directamente desde Content Island?»**
Se podría, pero entonces el secreto vive en el CMS y te quedas sin historial de
ejecuciones. Con la Action en medio, los secretos siguen en GitHub y tienes logs.

**«¿Cuánto tarda en verse un cambio?»**
Lo que tarde el workflow (segundos) más lo que quede del intervalo de sondeo. Con
el intervalo en cinco minutos, el peor caso son cinco minutos.

**«¿Se me va a borrar el Redis gratuito?»**
Solo si pasa catorce días sin recibir comandos. Una app desplegada con tráfico lo
mantiene vivo con su propio sondeo. Un preview parado, no.

**«¿Y si necesito rollback de contenido?»**
Por aquí no. El cliente solo adopta snapshots más nuevos, para protegerte de
publicar hacia atrás sin querer. Para volver a un estado anterior, se republica en
Content Island.
