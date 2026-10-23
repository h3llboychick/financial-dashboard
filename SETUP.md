# Setup

This guide covers local development setup for Financial Dashboard.

## Requirements

- Node.js 24 or newer
- npm

## Install Dependencies

From the repository root:

```bash
npm run install:all
```

## Configure Environment

Copy the server environment example:

```bash
cp server/.env.example server/.env
```

Generate encryption keys:

```bash
npm run secrets:generate --prefix server
```

Paste the generated `DATABASE_ENCRYPTION_KEY` and `CREDENTIALS_KEK` values into `server/.env`.

For local development, set:

```env
NODE_ENV=dev
DEV_AUTH_USER_ID=1
PORT=3001
DATABASE_PATH=spendings.db
JWT_SECRET=replace-with-a-long-random-string
```

Telegram variables are only required when testing the real Telegram login flow:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_BOT_NAME=your_bot_username_without_@
```

Optional client environment variables live in `client/.env`. Copy the example if you need to expose the Vite dev server through a tunnel:

```bash
cp client/.env.example client/.env
```

For ngrok or another tunnel, set one or more comma-separated hosts without the protocol:

```env
VITE_ALLOWED_HOSTS=your-ngrok-domain.ngrok-free.dev
```

## Run Locally

Start the client and server together:

```bash
npm run dev
```

The Vite client runs with a development auth bypass by default. The API runs in dev mode when `NODE_ENV=dev`, using `DEV_AUTH_USER_ID` as the authenticated user.

## Demo Screenshot Data

Seed a separate encrypted demo database with sanitized example data:

```bash
npm run seed:demo
```

The script creates `server/demo-screenshot.db` by default, resets only the demo user in that database, and prints the exact command for starting the app against it. Capture the dashboard and save the image at:

```text
docs/screenshots/dashboard-demo.png
```

## Database And Migrations

The server runs migrations automatically on startup.

Useful migration commands:

```bash
npm run migrate:status --prefix server
npm run migrate:up --prefix server
npm run migrate:down --prefix server
```

## Tests And Build

Run the server test suite:

```bash
npm test --prefix server
```

Build the frontend:

```bash
npm run build --prefix client
```

## Production Notes

Build the client first:

```bash
npm run build
```

Then start the Express server in production mode:

```bash
npm start
```

In production, configure real Telegram credentials, strong JWT and encryption secrets, and a persistent encrypted SQLite database path.

### HTTP Security Headers

Express applies Helmet before CORS, body parsing, authentication, API routes, and static files, so security headers also cover preflight and error responses. No new environment variables are required.

- Serve production traffic over HTTPS, typically through a TLS-terminating reverse proxy. With `NODE_ENV=production`, Helmet sends HSTS (`max-age=31536000; includeSubDomains`) and CSP `upgrade-insecure-requests`. All subdomains covered by HSTS must support HTTPS. These two settings are disabled outside production to keep local HTTP development working. HSTS does not configure TLS or redirect an initial HTTP request; configure the proxy to redirect HTTP to HTTPS.
- The content security policy permits scripts from this app and `https://telegram.org`, and frames from this app and `https://oauth.telegram.org`. Browser API requests stay on the same origin; exchange-rate and exchange-provider calls happen on the server and need no CSP exceptions. Same-origin opener protection allows popups so Telegram login can communicate with its authentication window.
- The legacy Telegram widget evaluates its `data-onauth` callback, so `script-src` temporarily permits `'unsafe-eval'`. Inline script blocks and script attributes remain blocked. Remove the eval exception when migrating away from the legacy widget to a login integration that accepts a function callback without evaluation.
- Inline styles remain allowed for React/Recharts and the development-only Swagger UI. Tightening this requires replacing inline styles and adding nonces or hashes for Swagger's style blocks. Swagger's JavaScript is served from the same origin.

Helmet protects responses served by Express. During local development, the separate Vite server serves the client HTML. When adding browser-side third-party services, update the CSP allowlist and verify Telegram login and browser console messages before deployment.
