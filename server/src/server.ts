import dotenv from "dotenv";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { startRecurringJob } from "./jobs/recurring.job.js";

dotenv.config();

const port = process.env.PORT || 5000;
const app = createApp();

connectDb().then(() => {
  startRecurringJob();
  app.listen(port, () => {
    console.log(`RupeeFlow API listening on port ${port}`);
  });
});
