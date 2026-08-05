import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { authCookieName } from "../utils/tokens.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = readCookie(req.headers.cookie || "", authCookieName)
      || (header.startsWith("Bearer ") ? header.slice(7) : null);
    if (!token) {
      const error: any = new Error("Authentication required");
      error.statusCode = 401;
      throw error;
    }

    const payload = jwt.verify(token, env().JWT_SECRET, {
      issuer: "rupeeflow-api",
      audience: "rupeeflow-web"
    });
    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user) {
      const error: any = new Error("User no longer exists");
      error.statusCode = 401;
      throw error;
    }

    req.user = user;
    next();
  } catch (error) {
    (error as any).statusCode = (error as any).statusCode || 401;
    next(error);
  }
}

function readCookie(cookieHeader: string, name: string) {
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}
