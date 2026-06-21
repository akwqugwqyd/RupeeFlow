import type { HydratedDocument } from "mongoose";
import type User from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      user?: HydratedDocument<any>;
      validated?: any;
    }
  }
}

