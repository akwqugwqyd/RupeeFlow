# RupeeFlow

RupeeFlow is a personal finance web app I built to track income, expenses, budgets, and recurring transactions in one place.

It also includes an AI assistant that can answer simple questions about the user's spending based on the data stored in the app.

## Features

- User registration and login
- Add, edit, delete, and filter transactions
- Track income and expenses
- Category-wise spending
- Monthly budgets
- Recurring transactions
- Dashboard with charts and summaries
- CSV export
- AI-based finance insights

## Tech Stack

- React
- TypeScript
- Tailwind CSS
- Node.js
- Express
- MongoDB
- Mongoose
- JWT authentication
- OpenAI API
- Vercel

## Project Structure

```text
client/   React frontend
server/   Express backend
api/      Vercel serverless API entry
```

## Running Locally

Install and start the backend:

```bash
cd server
npm install
npm run dev
```

Install and start the frontend in another terminal:

```bash
cd client
npm install
npm run dev
```

The frontend will run at:

```text
http://localhost:5173
```

## Environment Variables

Create a `.env` file inside the `server` folder.

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_jwt_secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
OPENAI_API_KEY=your_openai_key_optional
OPENAI_MODEL=gpt-4o-mini
NODE_ENV=development
```

For local frontend development, create `client/.env` if needed:

```env
VITE_API_URL=http://localhost:5000/api
```

## Deployment

The project is deployed on Vercel as a single project.

Important Vercel settings:

- Root Directory: leave empty
- Build Command: `npm --prefix client run build`
- Output Directory: `client/dist`
- Install Command: `npm --prefix client ci && npm --prefix server ci`

Add the required environment variables in Vercel before deploying.

## Notes

- Do not commit `.env` files.
- Use a strong `JWT_SECRET` in production.
- Make sure MongoDB Atlas allows access from Vercel.

