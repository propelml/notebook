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

import * as fs from "fs";
import * as http from "http";
import * as mime from "mime";
import * as path from "path";
import * as url from "url";

const basePath = path.join(__dirname, "../build/website");
const index = path.join(basePath, "index.html");

// create a simple HTTP server to serve static files.
export function createHTTPServer() {
  const server = http.createServer((req, res) => {
    const reqUrl = url.parse(req.url, true);
    const filePath = path.join(basePath, reqUrl.pathname);
    if (!filePath.startsWith(basePath)) {
      res.writeHead(403, { "Content-Type": "text/html; charset=utf-8" });
      res.end("Access denied.");
      return;
    }
    fs.stat(filePath, (err, stat) => {
      let finalPath = filePath;
      if (err && err.code === "ENOENT" || stat.isDirectory()) {
        finalPath = index;
      } else if (err) {
        res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`Unexpected server error occurred. [#${err.code}]`);
        return;
      }
      res.writeHead(200, { "Content-Type": mime.getType(finalPath) });
      const stream = fs.createReadStream(finalPath);
      stream.pipe(res);
    });
  });
  return server;
}
