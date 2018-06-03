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
// tslint:disable:variable-name
// This is the propelml.org website. It is used both server-side and
// client-side for generating HTML.

export let firebaseUrls = [
  "https://www.gstatic.com/firebasejs/4.9.0/firebase.js",
  "https://www.gstatic.com/firebasejs/4.9.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/4.9.0/firebase-firestore.js"
];

// Called by tools/build_website.ts
export function getHTML(title, markup) {
  const scriptTags = firebaseUrls
    .map(u => `<script src="${u}"></script>`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <meta id="viewport" name="viewport" content="width=device-width,
      minimum-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
    <link rel="stylesheet" href="/bundle.css"/>
    ${scriptTags}
    <script src="/main.js"></script>
    <link rel="icon" type="image/png" href="./favicon.png">
  </head>
  <body>${markup}
  <script async
    src="https://www.googletagmanager.com/gtag/js?id=UA-112187805-1"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'UA-112187805-1');
  </script>
  </body>
</html>`;
}
