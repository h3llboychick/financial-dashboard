# Financial Dashboard

A self-hosted budgeting dashboard for observing financial state in real time and understanding where spending goes.

![Financial Dashboard demo dashboard](docs/screenshots/dashboard-demo.png)

## Why I Built This

I built this project to observe my financial state in real time, understand where my spending goes, make more informed financial decisions, and plan my budget with less friction.

Instead of keeping expenses, balances, and investment-related notes spread across separate tools, this app gives me one place to track daily entries, compare monthly activity, and keep a clearer picture of my budget.

## What It Does

- Tracks income, spending, and investment entries through separate ledgers.
- Organizes transactions with ledger-specific categories and color-coded breakdowns.
- Shows monthly totals, charts, and category-level spending insights.
- Supports multiple currencies for entries and dashboard reporting.
- Tracks fiat wallets with baseline balances and entry-based balance updates.
- Moves money between wallets as transfers, without creating ledger entries.
- Creates recurring entries, such as a scholarship or a subscription, on a schedule you choose: a day of the month, the last day, a weekday, every N days or once a year.
- Supports exchange wallets, encrypted API credentials, and live crypto exchange balance checks.
- Uses Telegram login for authentication.
- Includes a responsive dark mode interface.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS, Recharts
- **Backend:** Node.js, Express, SQLite, Umzug
- **Auth and security:** Telegram Login Widget, JWT, encrypted SQLite database, encrypted exchange credentials (KEK/DEK encryption)
- **Tooling:** Jest, GitHub Actions, custom scripts

## Architecture

The app is split into a Vite React client and an Express API server. The frontend talks to REST endpoints under `/api`; the server keeps business logic organized through route, controller, and repository layers; SQLite stores application data behind migrations and encryption.

```mermaid
flowchart LR
  User[User] --> Client[React + Vite client]
  Client --> API[Express API]
  API --> Routes[Routes]
  Routes --> Controllers[Controllers]
  Controllers --> Repositories[Repositories]
  Repositories --> DB[(Encrypted SQLite)]

  API --> Telegram[Telegram auth]
  API --> ExchangeRates[Exchange-rate API]
  API --> Exchanges[Crypto exchange APIs, e.g. Kraken]
```

In production, the Express server can also serve the built client from `client/dist`, keeping the deployable app as a single Node process.

## Security

Financial data is sensitive, so the project is designed around local ownership and explicit secrets:

- Telegram login is verified on the server before issuing a JWT session token.
- Runtime secrets live in environment variables.
- The SQLite database is encrypted with a dedicated database encryption key (using AES-GCM-256).
- Exchange API credentials use envelope encryption with a separate credential encryption key (KEK/DEK encryption).

Pull requests must pass dependency review, CodeQL analysis, and secret scanning before merging:

- [Dependency review](.github/workflows/security.yml) blocks newly introduced high or critical vulnerabilities in runtime and development dependencies. It requires the repository's dependency graph to be enabled.
- CodeQL uses GitHub's default setup with the extended query suite for JavaScript/TypeScript and GitHub Actions. Manage it under **Settings → Advanced Security → CodeQL analysis**. A `master` ruleset requires CodeQL results and blocks new high or critical security alerts and standard errors. Default setup scans PRs from this repository's branches; switch to advanced setup before accepting PRs from forks.
- [Secret scanning](.github/workflows/ci.yml) runs Gitleaks over the full Git history with redacted output. GitGuardian also checks pull requests.

Dependency review and CodeQL are free for this public repository. Keep their check names and expected GitHub apps in the `master` branch protection rule aligned with the actual check runs; requiring a check does not enable its scanner.

## Setup

Installation, local development, environment variables, and production notes are documented in [SETUP.md](SETUP.md).

CI publishes a tested deployment artifact for successful builds on `master`. Production deployment runs separately in a private repository so server credentials and deployment logs are not exposed through public workflow runs. Operators select a successful CI build there; PR builds cannot deploy.

## Roadmap

- Expand automated test coverage (including dedicated security tests) across API routes and important frontend flows.
- Add more exchange integrations beyond Kraken.
- Improve reporting with exports and richer budgeting trends.

## License

MIT
