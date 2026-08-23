import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart({
      // Nada bajo src/server/ puede acabar en el bundle del navegador. Ese
      // código lee secretos (el token de Content Island, la URL de Redis con su
      // contraseña, el secreto del endpoint de refresco), así que si alguien lo
      // importa por error desde un componente, el build falla en vez de
      // publicarlos. Protege también los ficheros que aún no existen, que es lo
      // que no consigue la convención `*.server.ts`.
      importProtection: {
        client: {
          files: ['**/src/server/**'],
        },
      },
    }),
    viteReact(),
  ],
})

export default config
