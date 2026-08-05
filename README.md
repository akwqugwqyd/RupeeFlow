# RupeeFlow

I built RupeeFlow to make everyday expense tracking less manual. It combines the usual personal-finance tools—transactions, budgets, recurring payments, and reports—with an AI assistant that only answers from the user's own finance data.

The project is designed for Indian spending habits, so the UI uses INR and recognises common payment methods such as UPI, cards, wallets, and bank transfers.

## What it can do

- Track, edit, filter, and export income and expenses
- Import a bank statement from CSV with column mapping and a review step
- Detect duplicate rows before an import is saved
- Turn text such as `Paid ₹450 to Zomato via UPI yesterday` into a transaction draft
- Track monthly budgets and warn when spending is likely to cross a limit
- Generate dashboards, category breakdowns, and monthly comparisons
- Create and pause recurring monthly or yearly transactions
- Answer finance questions with calculation details and links to the supporting transactions
- Continue working without an OpenAI key by using deterministic fallback rules

## Stack

- React 19, TypeScript, Vite, Tailwind CSS, and Recharts
- Node.js, Express 5, TypeScript, and Zod
- MongoDB and Mongoose
- JWT sessions stored in secure httpOnly cookies
- OpenAI API for structured transaction extraction and grounded finance responses
- Vercel for the web client and serverless API

## Project layout

```text
api/                 Vercel serverless entry point
client/              React application
scripts/             Root development scripts
server/              Express API, models, services, and tests
package.json         Commands shared by the whole repository
vercel.json          Vercel build, route, function, and cron settings
```

The browser calls `/api` in both environments. During local development Vite proxies those requests to the Express server on port 5000. On Vercel, the same path is routed to `api/index.ts`.

## Run it locally

You need Node.js 22 or newer and a MongoDB connection string. The OpenAI key is optional.

Install both applications:

```bash
npm run setup
```

Copy `server/.env.example` to `server/.env` and add your values:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=use_a_random_value_at_least_32_characters_long
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
LOG_LEVEL=info
```

Start the client and API together:

```bash
npm run dev
```

Then open:

- App: http://localhost:5173
- API health check: http://localhost:5000/api/health

On Windows PowerShell, use `npm.cmd` instead of `npm` if the execution policy blocks `npm.ps1`:

```powershell
npm.cmd run setup
npm.cmd run dev
```

If the client opens but requests fail, check the API health URL first. The usual causes are an invalid `server/.env`, a MongoDB Atlas IP-access rule, or another process already using port 5000.

## Checks

These are the same commands I run before deploying:

```bash
npm run typecheck
npm test
npm run build
```

There is also an end-to-end smoke test. It creates a uniquely named temporary database using `MONGODB_URI`, tests the full API flow, and deletes that database when it finishes:

```bash
npm run test:e2e
```

## Deploy on Vercel

This repository is deployed as one Vercel project. The client is built into `client/dist`, and requests under `/api` are handled by the serverless function.

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Leave the root directory at the repository root. `vercel.json` already supplies the install command, build command, output directory, rewrites, function duration, and daily cron.
4. Add the following environment variables before the first deployment:

```text
NODE_ENV=production
MONGODB_URI=your_production_mongodb_connection_string
JWT_SECRET=your_production_secret_of_at_least_32_characters
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-project.vercel.app
OPENAI_API_KEY=optional
OPENAI_MODEL=gpt-4o-mini
CRON_SECRET=a_separate_random_secret
LOG_LEVEL=info
```

5. Deploy, then verify `/api/health`, registration, CSV import, and one AI-chat question.

MongoDB Atlas must accept connections from the deployed function. Keep development and production databases separate, and never commit `.env` files or credentials.

Pushes to the production branch create production deployments. Other branches and pull requests receive Vercel preview deployments.
