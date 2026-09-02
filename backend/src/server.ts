import { createApp } from "./app.js";
import { env } from "./config/env.config.js";
import { registerShutdown } from "./shutdown.js";
import {
  attachWebSocketServer,
  createMessageCreatedPublisher,
  createWebSocketConnectionRegistry,
} from "./websocket.js";

const connectionRegistry = createWebSocketConnectionRegistry();
const publishMessageCreated = createMessageCreatedPublisher(connectionRegistry);
const app = createApp({ publishMessageCreated });

const port = env.port ?? 3000;

const server = app.listen(port, (error) => {
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`App listening on port ${port}`);
});

attachWebSocketServer(server, connectionRegistry);
registerShutdown(server);
