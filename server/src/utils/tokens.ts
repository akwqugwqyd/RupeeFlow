import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const authCookieName = "rupeeflow_session";

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, env().JWT_SECRET, {
    expiresIn: env().JWT_EXPIRES_IN as any,
    issuer: "rupeeflow-api",
    audience: "rupeeflow-web"
  });
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: tokenMaxAgeMs(env().JWT_EXPIRES_IN)
  };
}

export function authCookieClearOptions() {
  const { maxAge, ...options } = authCookieOptions();
  return options;
}

function tokenMaxAgeMs(value: string) {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2] || "s";
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}
