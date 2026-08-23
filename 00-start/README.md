Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
npm install
npm run dev
```

# Building For Production

To build this application for production:

```bash
npm run build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`


## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `CONTENT_ISLAND_ACCESS_TOKEN` | yes | Access token for the Content Island API. Read server-side only (`process.env`), so it must **not** carry the `VITE_` prefix. |

Copy `.env.example` to `.env` for local development.

## Deploy to Vercel

No adapter to install. Nitro is already a dependency and the `nitro()` plugin is registered in
`vite.config.ts`, which is all Vercel's TanStack Start guide asks for. During a Vercel build the
`VERCEL` environment variable is set, Nitro auto-selects its `vercel` preset and emits
`.vercel/output` (Build Output API v3).

> Do **not** hardcode `nitro({ preset: 'vercel' })` in `vite.config.ts` — that would also change the
> local build, which uses the default `node-server` preset and emits `.output/`.

Project settings on Vercel:

| Setting | Value |
| --- | --- |
| Root Directory | `00-start` (the git repo root is the parent folder) |
| Framework Preset | TanStack Start (auto-detected) |
| Build Command | `npm run build` (default) |
| Output Directory | leave empty — Nitro writes `.vercel/output` |
| Node.js Version | `22.x` (Nitro's Vercel preset only emits `nodejs20.x` / `nodejs22.x`) |
| Environment Variables | `CONTENT_ISLAND_ACCESS_TOKEN` |

### Option A — Git integration

Push the repo, then import it at [vercel.com/new](https://vercel.com/new). Set **Root Directory** to
`00-start` during the import. Every push to `main` triggers a production deployment, and every other
branch gets a preview deployment.

### Option B — Vercel CLI

Run every command from inside `00-start/`.

```bash
npm i -g vercel        # or use npx vercel for every command below
vercel login
```

**1. Link the local folder to a Vercel project.**

```bash
vercel link
```

If the project was already created through the Git integration, pick it from the list and the CLI
links to it instead of creating a duplicate. When it asks *"In which directory is your code
located?"*, answer `./` — you are already inside `00-start`, which is the Root Directory.

This writes `.vercel/project.json` with the org and project IDs. That folder is gitignored.

**2. Environment variables.**

```bash
vercel env add CONTENT_ISLAND_ACCESS_TOKEN production
vercel env add CONTENT_ISLAND_ACCESS_TOKEN preview
vercel env pull .env.local                              # bring them down for local dev
```

`vercel env pull` writes `.env.local`, which Nitro loads in dev on top of `.env` (verified: with a
bad token in `.env` and a good one in `.env.local`, `npm run dev` uses the good one). Both files are
gitignored.

**3. Deploy.**

```bash
vercel              # preview deployment, prints a unique URL
vercel --prod       # production deployment
```

Both build on Vercel's infrastructure. To build locally instead — useful for debugging a build
failure without waiting on the queue:

```bash
vercel build            # produces .vercel/output on your machine
vercel deploy --prebuilt
```

**Useful checks.**

```bash
vercel ls               # recent deployments
vercel logs <url>       # runtime logs of a deployment
vercel inspect <url>    # what was built, function sizes
```

To reproduce Vercel's build with plain npm, without the CLI and without changing any file:

```bash
NITRO_PRESET=vercel npm run build
```

Expect `.vercel/output/config.json` (Build Output API v3) and
`.vercel/output/functions/__fallback.func/.vc-config.json` with `"runtime": "nodejs22.x"`.

### Running on a plain Node host

The default build emits a self-contained Node server in `.output/`:

```bash
npm run build
node .output/server/index.mjs
```

For other host presets (Netlify, Cloudflare, AWS Lambda, etc.) see https://nitro.build/deploy.


## Shadcn

Add components using the latest version of [Shadcn](https://ui.shadcn.com/).

```bash
pnpm dlx shadcn@latest add button
```



## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from "@tanstack/react-router";
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')
  
  useEffect(() => {
    getServerTime().then(setTime)
  }, [])
  
  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).



# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
