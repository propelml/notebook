#!/usr/bin/ts-node
/*!
   Copyright 2018 Propel http://propel.site/.  All rights reserved.
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

/**
 * This file contains "propel" command which can be used
 * to start a local web server and execute codes on Node.js
 * from notebook (browser).
 */

import { fork, isMaster } from "cluster";
import * as opn from "opn";
import * as WebSocket from "ws";
import { ClusterRPC } from "../src/rpc";
import { createHTTPServer } from "./server";

// Constants
const PORT = 8081;

if (isMaster) {
  // Start a websocket server in master process.
  const server = createHTTPServer();
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws: WebSocket) => {
    // For now, let's create a new process for each connection and load
    // sandbox.ts in there.
    const worker = fork();
    const rpc = new ClusterRPC(worker, true);
    // To prevent "channel not active." error.
    rpc.start({});
    // Route all messages from child process to client.
    worker.on("message", msg => {
      const message = JSON.stringify(msg);
      ws.send(message);
    });
    // Route all valid messages to the child process.
    ws.on("message", rawData => {
      try {
        const data = JSON.parse(String(rawData));
        rpc.call(data.type, data);
      } catch (e) {
        console.error(e);
      }
    });
    // Kill a child process whenever user disconnects.
    ws.on("close", () => {
      rpc.stop();
      worker.kill();
    });
  });

  server.listen(PORT, () => {
    console.log("Propel server started on port %s.", PORT);
    opn(`http://localhost:${PORT}/?ws=${PORT}`);
  });
} else {
  console.log("[%s] Worker started.", process.pid);
  require("../src/sandbox.ts");
}
