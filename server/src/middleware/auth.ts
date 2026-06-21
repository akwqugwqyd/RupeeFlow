import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      const error: any = new Error("Authentication required");
      error.statusCode = 401;
      throw error;
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
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
