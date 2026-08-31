import { createApp } from "./app.js";
import { env } from "./config/env.config.js";
import { registerShutdown } from "./shutdown.js";

const app = createApp();

const port = env.port ?? 3000;

const server = app.listen(port, (error) => {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`App listening on port ${port}`);
});

registerShutdown(server);
