import "dotenv/config";
import http from "node:http";
import { createServerApplication } from "./app/index.js";
import { loadEnv } from "./env.js";

function main() {
  // loadEnv() validates and coerces PORT, so an invalid value fails fast here
  // rather than reaching listen() as NaN.
  const env = loadEnv();
  const server = http.createServer(createServerApplication());

  server.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

main();
