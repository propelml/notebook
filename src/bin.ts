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
import * as http from "http";
import * as WebSocket from "ws";
import { ClusterRPC } from "./rpc";

// Constants
const PORT = 8081;

if (isMaster) {
  // Start a websocket server in master process.
  const server = http.createServer();
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws: WebSocket) => {
    // For now, let's create a new process for each connection and load
    // sandbox.ts in there.
    const worker = fork();
    const rpc = new ClusterRPC(worker, true);
    // Route all messages from child process to client.
    worker.on("message", msg => {
      const message = JSON.stringify(msg);
      ws.send(message);
    });
    ws.on("message", rawData => {
      try {
        // Route all valid messages to the child process.
        const data = JSON.parse(String(rawData));
        rpc.call(data.type, data);
      } catch (e) {
        console.error(e);
      }
    });
  });

  server.listen(PORT, () => {
    console.log("WebSockeet server started on port %s.", PORT);
  });
} else {
  console.log("[%s] Worker started", process.pid);
  require("./sandbox.ts");
}
