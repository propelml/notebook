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

import { escape } from "he";
import { OutputHandlerDOM } from "./output_handler_dom";
import { getParameterByName } from "./router";
import { RPC, WebSocketRPC, WindowRPC } from "./rpc";
import { createResolvable, randomString } from "./util";

function createIframe(rpcChannelId): HTMLIFrameElement {
  const base = new URL("/sandbox", window.document.baseURI).href;
  const html = `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="rpc-channel-id" content="${escape(rpcChannelId)}"/>
        <base href="${escape(base)}">
        <script async type="text/javascript" src="/sandbox.js">
        </script>
      </head>
      <body>
      </body>
    </html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("srcdoc", `${html}`);
  // Edge doesn't support "srcdoc", it'll use a data url instead.
  iframe.setAttribute("src", `data:text/html,${html}`);
  iframe.style.display = "none";
  document.body.appendChild(iframe);

  return iframe;
}

export type CellId = number | string;

export class VM {
  private iframe: HTMLIFrameElement;
  private RPC: RPC;
  private ws: WebSocket;
  readonly id: string;
  readonly wsServer = null;

  constructor(private rpcHandler) {
    this.id = randomString();
    this.wsServer = getParameterByName("ws");
  }

  async init() {
    if (this.RPC) return;
    try {
      if (!this.wsServer) throw new Error("");
      console.log("Connecting to ws-backend: %s.", this.wsServer);
      const wsPromise = createResolvable();
      this.ws = new WebSocket(this.wsServer);
      this.ws.onopen = wsPromise.resolve;
      await wsPromise;
      console.log("Connected to server.", this.wsServer);
      this.RPC = new WebSocketRPC(this.ws);
      this.RPC.start(this.rpcHandler);
    } catch (e) {
      console.log("Using iframe sandbox.", this.wsServer);
      this.iframe = createIframe(this.id);
      this.RPC = new WindowRPC(this.iframe.contentWindow, this.id);
      this.RPC.start(this.rpcHandler);
    }
  }

  async exec(code: string, id: CellId) {
    await this.init();
    await this.RPC.call("runCell", code, id);
  }

  destroy() {
    if (!this.RPC) return;
    this.RPC.stop();
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    if (this.ws) {
      this.ws.close();
    }
    this.RPC = null;
    this.iframe = null;
    this.ws = null;
  }
}

export type LookupCell = (c: CellId) => OutputHandlerDOM;
export function createRPCHandler(lookupCell: LookupCell) {
  return {
    plot(cellId: CellId, data: any): void {
      const oh = lookupCell(cellId);
      if (!oh) return;
      oh.plot(data);
    },

    print(cellId: CellId, data: any): void {
      const oh = lookupCell(cellId);
      if (!oh) return;
      oh.print(data);
    },

    downloadProgress(cellId: CellId, data: any): void {
      const oh = lookupCell(cellId);
      if (!oh) return;
      oh.downloadProgress(data);
    }
  };
}
