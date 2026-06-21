# RupeeFlow

RupeeFlow is a full-stack personal finance app for tracking income, expenses, budgets, recurring transactions, and AI-assisted money insights. I built it as a resume-grade project with a separate React frontend and Express API instead of a single tutorial-style app.

## What It Does

- Register and log in with JWT-based authentication
- Add, edit, delete, filter, and export income/expense transactions
- Manage predefined and custom categories
- Mark transactions as recurring and auto-create them monthly with a cron job
- Set monthly category budgets and see usage progress
- View a dashboard with income, expenses, savings rate, category charts, trends, and recent activity
- Ask the AI finance assistant questions about spending, budgets, and month-over-month changes
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
client/   React + TypeScript frontend
server/   Express + TypeScript API
```

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
```

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
