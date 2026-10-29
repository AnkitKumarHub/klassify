import type { Application } from "express";
import { createUserRouter } from "./user.route.js";

export function mountUserRoutes(app: Application) {
  app.use("/api/v1", createUserRouter());
}
