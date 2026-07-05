import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env().JWT_SECRET, {
    expiresIn: env().JWT_EXPIRES_IN as any,
    issuer: "rupeeflow-api",
    audience: "rupeeflow-web"
  });
}
