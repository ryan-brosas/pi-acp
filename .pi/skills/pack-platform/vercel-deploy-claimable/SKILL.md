---
name: vercel-deploy-claimable
description: "Use when the user requests a Vercel deployment action like deploy my app, deploy to production, create a preview deployment, or push this live. Returns a preview URL and a claimable deployment link."
disable-model-invocation: true
---


# Vercel Deploy

## When to Use

- When the user requests deploying a project to Vercel and needs preview/claim links.

## When NOT to Use

- When deployment is not requested or targets a non-Vercel platform.


## Prerequisite

This skill needs a local deploy helper script. Resolve its path from `$VERCEL_DEPLOY_SCRIPT` or ask the user — never assume a machine-specific path (for example `/mnt/skills/...`). The helper must:
- Exclude secret files (`.env*`, credentials, key files) from the upload in addition to `node_modules` and `.git`.
- Never mutate the input tree in place (stage a temporary copy if it needs to rename or transform files).
- Show the exact command it runs before executing.

## How It Works

1. Packages your project into a tarball (excludes `node_modules`, `.git`, and secret files)
2. Auto-detects framework from `package.json`
3. Uploads to deployment service
4. Returns **Preview URL** (live site) and **Claim URL** (transfer to your Vercel account)

## Usage

```bash
bash "$VERCEL_DEPLOY_SCRIPT" [path]
```

**Arguments:**

- `path` - Directory to deploy, or a `.tgz` file (defaults to current directory)

**Examples:**

```bash
# Deploy current directory
bash "$VERCEL_DEPLOY_SCRIPT"

# Deploy specific project
bash "$VERCEL_DEPLOY_SCRIPT" /path/to/project

# Deploy existing tarball
bash "$VERCEL_DEPLOY_SCRIPT" /path/to/project.tgz
```

## Output

```
Preparing deployment...
Detected framework: nextjs
Creating deployment package...
Deploying...
✓ Deployment successful!

Preview URL: https://skill-deploy-abc123.vercel.app
Claim URL:   https://vercel.com/claim-deployment?code=...
```

The script also outputs JSON to stdout for programmatic use:

```json
{
  "previewUrl": "https://skill-deploy-abc123.vercel.app",
  "claimUrl": "https://vercel.com/claim-deployment?code=...",
  "deploymentId": "dpl_...",
  "projectId": "prj_..."
}
```

## Framework Detection

The script auto-detects frameworks from `package.json`. Supported frameworks include:

- **React**: Next.js, Gatsby, Create React App, Remix, React Router
- **Vue**: Nuxt, Vitepress, Vuepress, Gridsome
- **Svelte**: SvelteKit, Svelte, Sapper
- **Other Frontend**: Astro, Solid Start, Angular, Ember, Preact, Docusaurus
- **Backend**: Express, Hono, Fastify, NestJS, Elysia, h3, Nitro
- **Build Tools**: Vite, Parcel
- **And more**: Blitz, Hydrogen, RedwoodJS, Storybook, Sanity, etc.

For static HTML projects (no `package.json`), framework is set to `null`.

## Static HTML Projects

For projects without a `package.json`:

- If there's a single `.html` file not named `index.html`, it gets renamed automatically
- This ensures the page is served at the root URL (`/`)

## Present Results to User

Always show both URLs:

```
✓ Deployment successful!

Preview URL: https://skill-deploy-abc123.vercel.app
Claim URL:   https://vercel.com/claim-deployment?code=...

View your site at the Preview URL.
To transfer this deployment to your Vercel account, visit the Claim URL.
```

## Troubleshooting

### Network Egress Error

If deployment fails due to network restrictions, surface the provider error and ask the user to allow the required domains in their runtime/network settings, then retry:

```
Deployment failed due to network restrictions. To fix this:

1. Allow the required provider domains in the runtime/network settings
2. Try deploying again
```
