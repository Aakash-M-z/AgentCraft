import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { config } from "dotenv";
import { resolve } from "path";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedExamples } from "./lib/seed";
import { loadDB } from "./lib/store";

// Load .env from repo root (override any previously set values)
config({ path: resolve(import.meta.dirname, "../../.env"), override: true });

// Restore persisted workflows, then seed examples if store is empty
loadDB();
seedExamples();

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
