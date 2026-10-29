import { Router, type Router as ExpressRouter } from "express";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  createUserController,
  getUserController,
  listUsersController,
  updateUserController,
} from "./user.controller.js";

export function createUserRouter(): ExpressRouter {
  const router = Router();

  // Every route here is admin-only, so the guard is applied to the whole
  // router rather than repeated per route, where one omission would be a hole.
  // A user's own profile is served by GET /auth/me instead.
  router.use("/users", requireAuth, requireRole("admin"));

  router.get("/users", listUsersController);
  router.post("/users", createUserController);
  router.get("/users/:id", getUserController);
  router.patch("/users/:id", updateUserController);

  return router;
}
