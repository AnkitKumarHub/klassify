import type { Application } from "express";
import { createTicketRouter } from "./ticket.route.js";

export function mountTicketRoutes(app: Application) {
  app.use("/api/v1", createTicketRouter());
}
