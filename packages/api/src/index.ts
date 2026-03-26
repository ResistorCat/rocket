import { Elysia } from "elysia";
import type { HealthResponse } from "@rocket/shared";

const app = new Elysia()
  .get("/", (): HealthResponse => ({
    status: "ok",
    message: "Hello from Rocket API 🚀",
  }))
  .get("/health", (): HealthResponse => ({
    status: "ok",
    message: "API is running",
  }))
  .listen(3000);

console.log(
  `🚀 Rocket API is running at http://${app.server?.hostname}:${app.server?.port}`
);
