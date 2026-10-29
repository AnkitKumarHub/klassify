import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import {
  createCommentController,
  createTicketController,
  getTicketController,
  listTicketsController,
  updateTicketController,
} from "./ticket.controller.js";

export function createTicketRouter(): ExpressRouter {
  const router = Router();

  // Any authenticated account may file a ticket; the creator is taken from the
  // session, so this route needs no role restriction of its own.
  router.post("/tickets", requireAuth, createTicketController);

  // Both roles share this route. The result set is scoped to the caller inside
  // the service, so a user requesting it cannot widen it with query params.
  router.get("/tickets", requireAuth, listTicketsController);

  // Ownership is checked in the service, which answers 404 for a ticket the
  // caller may not see, so existence is never confirmed to the wrong user.
  router.get("/tickets/:id", requireAuth, getTicketController);

  // Commenting reuses the read guard: whoever may read a ticket may comment on
  // it, so the two permissions cannot drift apart.
  router.post("/tickets/:id/comments", requireAuth, createCommentController);

  // The only route where the roles really diverge: an admin sets any status and
  // assigns, a user may just close their own. Both cases are decided in the
  // service, which refuses with 403 once ownership is established.
  router.patch("/tickets/:id", requireAuth, updateTicketController);

  return router;
}
