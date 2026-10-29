import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import { loadEnv } from "../env.js";
import { mountAuthRoutes } from "./auth/auth.module.js";
import { errorHandler, notFoundHandler } from "./shared/error-handler.js";
import { mountTicketRoutes } from "./tickets/ticket.module.js";
import { mountUserRoutes } from "./users/user.module.js";

export function createServerApplication(): Application {
  const env = loadEnv();
  const app = express();

  app.use(cookieParser());
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "support-portal-api",
      timestamp: new Date().toISOString(),
    });
  });

  mountAuthRoutes(app);
  mountTicketRoutes(app);
  mountUserRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
