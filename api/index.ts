import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/src/app.js";
import { connectDb } from "../server/src/config/db.js";

const app = createApp();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await connectDb();
  return app(req, res);
}
