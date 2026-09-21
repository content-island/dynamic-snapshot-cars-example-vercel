# Guion: Dynamic Snapshot en Vercel

# Intro

En este vídeo vamos a desplegar un proyecto en Vercel con Dynamic Snapshot: la web se sirve desde un snapshot guardado en Redis y se refresca automáticamente cuando publicas contenido en Content Island. Para empezar, debes tener el código de `01-local` subido a un repositorio de GitHub.

# Paso 1: Crear el proyecto en Vercel

Entramos en el panel de Vercel con la cuenta de GitHub conectada, pulsamos `Add New` y elegimos `Project`.

![](images/01-dynamic-snapshot-car-example.png)

Buscamos el repositorio que acabamos de subir y le damos a `Import`.

![](images/02-dynamic-snapshot-car-example.png)

Vercel nos muestra la configuración básica del proyecto. Lo único que tocamos son las variables de entorno.

![](images/03-dynamic-snapshot-car-example.png)

Vamos a añadir cinco variables:
    - CONTENT_ISLAND_ACCESS_TOKEN: el token de lectura de tu proyecto, lo encuentras en la sección `General` de Content Island.
    - CONTENT_ISLAND_PROJECT_ID: es opcional. Solo prefija la clave de Redis, para que dos entornos que apunten a proyectos distintos puedan compartir la misma instancia.
    - REDIS_URL: la dejamos vacía de momento, la rellenaremos cuando creemos Redis.
    - SNAPSHOT_REFRESH_SECRET: una clave secreta para refrescar el snapshot de forma segura. La generamos en la terminal con `openssl rand -hex 32`.
    - SNAPSHOT_CHECK_INTERVAL_MS: cada cuánto se comprueba si hay cambios. En producción, 300000, cinco minutos. En desarrollo, 10000, diez segundos, para ver el efecto rápido.

Con las variables puestas, pulsamos `Crear`.

# Paso 2: Crear la instancia de Redis

Dentro del proyecto vamos a Storage y, en Marketplace Database Providers, elegimos Redis.

![](images/04-dynamic-snapshot-car-example.png)

En la pantalla de Install Integration configuramos la región, el tipo de almacenamiento y la disponibilidad. Verás que todos los planes son de pago, pero hay truco: en `High Availability` selecciona **None — free plan friendly** y tienes plan gratuito. Continuamos.

![](images/05-dynamic-snapshot-car-example.png)

Le damos un nombre a la instancia y pulsamos `Create`.

![](images/06-dynamic-snapshot-car-example.png)

Ahora Vercel nos pide asignar un proyecto y un prefijo para la variable con la URL de Redis. No puede llamarse igual que la que ya tenemos, así que la llamamos "STORAGE_REDIS_URL".

![](images/08-dynamic-snapshot-car-example.png)

Copiamos la URL de Redis y la pegamos en la variable REDIS_URL que habíamos dejado vacía.

![](images/09-dynamic-snapshot-car-example.png)

![](images/10-dynamic-snapshot-car-example.png)

Vercel nos avisa abajo a la izquierda de que la variable ha cambiado y de que hace falta un redeploy. Pulsamos `Redeploy` y esperamos a que termine.

![](images/11-dynamic-snapshot-car-example.png)

![](images/12-dynamic-snapshot-car-example.png)

# Paso 3: Configurar el webhook en Content Island

Vamos a la sección de `Overview` y copiamos la URL de nuestro proyecto desplegado, que la vamos a necesitar.

![](images/13-dynamic-snapshot-car-example.png)

En Content Island entramos en la sección de `Webhooks`, pulsamos `Add Webhook` y elegimos `Custom HTTP Webhook`.

![](images/14-dynamic-snapshot-car-example.png)

El formulario tiene dos partes. Arriba, la configuración: el nombre del webhook y la URL de nuestro despliegue. Abajo, la sección de `Headers`, donde añadimos uno con el nombre `x-refresh-secret` y, como valor, la misma clave que pusimos en SNAPSHOT_REFRESH_SECRET. Sin ese header, Vercel rechaza la petición.

![](images/15-dynamic-snapshot-car-example.png)

# Paso 4: Comprobar que funciona

Hay dos formas de comprobarlo. La rápida es el botón de `Send Test` dentro del webhook:

![](images/16-dynamic-snapshot-car-example.png)

Y en los logs de Vercel vemos que la petición ha llegado:

![](images/17-dynamic-snapshot-car-example.png)

La segunda es la de verdad. Nos vamos a la sección de `Content`, hacemos cualquier cambio y publicamos. Content Island dispara el webhook, Vercel refresca el snapshot y al recargar la página vemos el contenido nuevo.

# Cierre

Ya esta configurado, el sitio se sirve desde el snapshot en Redis, rápido, y se actualiza solo cada vez que publicas. Tienes todos los pasos escritos en la guía del repositorio. Nos vemos en el siguiente vídeo.
