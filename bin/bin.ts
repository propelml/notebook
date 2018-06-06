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
import { readFileSync } from "fs";
import * as opn from "opn";
import * as path from "path";
import { TextDecoder } from "util";
import * as vm from "vm";
import * as WebSocket from "ws";
import { ClusterRPC } from "../src/rpc";
import { createHTTPServer } from "./server";

// Constants
const PORT = 8081;
const sandboxSrc = path.join(__dirname, "../build/website/sandbox.js");

if (isMaster) {
  // Start a websocket server in master process.
  const server = createHTTPServer();
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws: WebSocket) => {
    // For now, let's create a new process for each connection and load
    // sandbox.ts in there.
    const worker = fork();
    // Route all messages from child process to client.
    worker.on("message", msg => {
      const message = JSON.stringify(msg);
      ws.send(message);
    });
    // Handle worker exit.
    worker.on("exit", () => {
      console.log("[%s] Worker exited.", worker.process.pid);
      if (ws.readyStatus === ws.OPEN) {
        ws.close();
      }
    });
    // Route all valid messages to the child process.
    ws.on("message", rawData => {
      try {
        const data = JSON.parse(String(rawData));
        worker.send(data);
      } catch (e) {
        console.error(e);
      }
    });
    // Kill a child process whenever user disconnects.
    ws.on("close", () => {
      worker.kill();
    });
  });

  server.listen(PORT, () => {
    console.log("Propel server started on port %s.", PORT);
    const wsUrl = `ws://localhost:${PORT}`;
    opn(`http://localhost:${PORT}/#/?ws=${wsUrl}`);
  });
} else {
  console.log("[%s] Worker started.", process.pid);
  const sandboxCode = readFileSync(sandboxSrc).toString();
  const clusterRPC = new ClusterRPC(process);
  const sandbox = {
    Buffer,
    TextDecoder,
    clusterRPC,
    process: {
      cwd: process.cwd,
      env: process.env,
      platform: process.platform
    },
    require: safeRequire
  };
  vm.createContext(sandbox);
  vm.runInContext(sandboxCode, sandbox);
}

function safeRequire(moduleName) {
  const allowedModules = ["url", "http", "https"];
  if (allowedModules.indexOf(moduleName) < 0) {
    console.log(moduleName);
    throw new Error("Calling require is forbidden.");
  }
  return require(moduleName);
}
