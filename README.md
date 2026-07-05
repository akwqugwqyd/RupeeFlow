# RupeeFlow

RupeeFlow is a production-oriented personal finance platform for tracking cash flow, budgets, recurring transactions, reports, and data-grounded AI insights.

## What It Does

- Register and log in with JWT-based authentication
- Add, edit, delete, filter, and export income/expense transactions
- Manage predefined and custom categories
- Mark transactions as recurring and auto-create them monthly with a cron job
- Set monthly category budgets and see usage progress
- View a dashboard with income, expenses, savings rate, category charts, trends, and recent activity
- Ask the AI finance assistant questions about spending, budgets, and month-over-month changes
- Detect projected budget overruns and unusual category spending
- View deterministic monthly, quarterly, and yearly report data
- Preview, pause, and resume date-anchored monthly or yearly recurring transactions
- Update profile details such as monthly income target
- Use Indian Rupees as the app-wide currency

## Tech Stack

**Frontend**

- React
- TypeScript
- Tailwind CSS
- Vite
- Recharts

**Backend**

- Node.js
- Express
- TypeScript
- MongoDB + Mongoose
- JWT auth
- OpenAI API
- node-cron

## Project Structure

```text
client/
  src/components/  reusable accessible UI
  src/hooks/       async state and reusable React behavior
  src/lib/         API client and typed domain API
  src/pages/       route-level screens
server/
  src/config/      validated environment and database lifecycle
  src/middleware/  authentication, validation, request context, errors
  src/models/      Mongoose schemas and indexes
  src/routes/      HTTP contracts and ownership boundaries
  src/services/    analytics and recurring domain logic
  src/utils/       deterministic finance functions, logging, tokens
```

All financial queries are scoped by the authenticated user ID. Route validation is performed before database access, while shared services own calculations used by dashboards and reports.

There are no root-level npm dependencies. Run frontend and backend commands from their own folders.

## Environment Variables

Create `server/.env` from `server/.env.example`.

```env
PORT=5000
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster-host/rupeeflow?retryWrites=true&w=majority
JWT_SECRET=replace-this-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
OPENAI_API_KEY=your_openai_key_optional
OPENAI_MODEL=gpt-4o-mini
LOG_LEVEL=info
NODE_ENV=development
```

Create `client/.env` from `client/.env.example` when deploying or when the API is not served from the same origin.

```env
VITE_API_URL=http://localhost:5000/api
```

For local Vite development, the app also works through the `/api` proxy.

## Run Locally

Start the backend:

```bash
cd server
npm install
npm run dev
```

Start the frontend in another terminal:

```bash
cd client
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Seed Demo Data

After MongoDB is connected:

```bash
cd server
npm run seed
```

Demo account:

```text
Email: demo@rupeeflow.app
Password: password123
```

## Build Checks

Frontend:

```bash
cd client
npm run build
```

Backend:

```bash
cd server
npm run build
npm test
```

## Finance Calculation Rules

- Transaction date ranges are half-open: `start <= date < end`. Date-only values are stored and grouped consistently in UTC; the default calendar month is derived in `Asia/Kolkata`.
- Currency totals are rounded to two decimals at service boundaries.
- Savings rate is `(income - expenses) / income × 100`; it is `0` when no income is recorded.
- Month-over-month percentage is `null` when the prior value is zero, because no honest percentage baseline exists.
- Budget projection is `spend / elapsed-month ratio`. Status is `over`, `at_risk`, `near`, or `healthy`.
- Unusual spending means current category spend is over 150% of its prior three-month monthly average.
- Recurrences retain their original day; dates such as the 31st clamp to the last day of shorter months without drifting.
- Generated recurrence keys are unique, making retries safe and preventing duplicate booked transactions.

The calculation edge cases are covered in `server/src/**/*.test.ts`.

## API Overview

All routes except registration, login, and health require `Authorization: Bearer <token>`.

| Route | Purpose |
| --- | --- |
| `GET/POST /api/transactions` | Filtered pagination and idempotent creation |
| `PUT/DELETE /api/transactions/:id` | Ownership-scoped update/delete |
| `GET /api/transactions/export/csv` | Filtered, formula-injection-safe CSV |
| `GET /api/transactions/recurring/preview` | Upcoming recurrence dates |
| `PATCH /api/transactions/:id/recurring-status` | Pause or resume a schedule |
| `GET /api/analytics/overview?month=YYYY-MM` | Dashboard analytics |
| `GET /api/analytics/report` | Monthly, quarterly, or yearly period totals |
| `GET/POST /api/budgets` | Budget limits, burn rate, projection, suggestions |
| `POST /api/ai/chat` | Grounded finance Q&A |

Transaction filters support `page`, `limit`, `type`, `category`, `search`, `minAmount`, `maxAmount`, `startDate`, and `endDate`.

## AI Behavior and Privacy

The assistant first runs an ownership-scoped finance query and then receives only relevant aggregates or minimized transaction fields. Prompts treat user and database strings as untrusted data. Temperatures are zero, numerical claims must come from the supplied context, empty evidence returns “Not enough data,” and responses carry a non-advice disclaimer. Merchant notes are not sent for recent-transaction analysis.

AI calls have a dedicated rate limit, timeout, and bounded retries. With no API key, deterministic rule-based answers remain available.

## Reliability and Security

- Startup rejects missing database configuration or JWT secrets shorter than 32 characters.
- JWTs validate issuer and audience; API, auth, and AI rate limits are separate.
- CORS uses an explicit allowlist. Helmet, body limits, ownership checks, and schema validation are enabled.
- Logs are structured JSON with request IDs and exclude common secret fields.
- Production errors hide internal details.
- SIGTERM/SIGINT stop the recurrence scheduler, drain HTTP requests, and close MongoDB.
- Compound indexes cover user/date/category/type access patterns.

For horizontal deployments, run the recurring scheduler in one designated worker. The database uniqueness key still protects against duplicate recurrence generation if jobs overlap.

## Docker

Set a strong secret and start the web app, API, and MongoDB:

```bash
JWT_SECRET=replace-with-at-least-32-random-characters docker compose up --build
```

Open `http://localhost:8080`. Production deployments should use managed MongoDB, TLS, a secrets manager, and same-site reverse-proxied API routing where practical.

## Manual Validation Flow

1. Register, add income and expenses on month boundaries, and confirm dashboard totals.
2. Edit and delete an expense; confirm category totals, budget usage, and reports change immediately.
3. Create a recurrence dated on the 29th–31st, preview it, pause/resume it, and run the recurrence test suite.
4. Filter by every transaction dimension and export; confirm the CSV matches the filter.
5. Ask AI about an empty period, a category, a budget, and month comparison; confirm all numbers are supported by visible data.

## Deployment Notes

For Vercel frontend deployment:

- Root directory: `client`
- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_API_URL` pointing to the deployed backend API URL

The backend is a persistent Express API with a cron job, so deploy it to a Node-friendly host such as Render, Railway, Fly.io, or a VPS. If you want to deploy the API on Vercel too, it should be adapted to Vercel serverless functions first.

## Security Notes

- Do not commit `.env` files.
- Rotate any exposed API keys before deploying.
- Use a strong `JWT_SECRET` in production.
- In MongoDB Atlas, allow only the IPs or services that need database access.
