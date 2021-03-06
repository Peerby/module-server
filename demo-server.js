/**
 * Copyright 2012 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var express = require('express');
var fs = require('fs');
var httpServer = require('./http-server')({
  sourceDir: '/test/fixtures/sample-module',
  buildDir: '/test/fixtures/build',
  moduleGraphFile: '/test/fixtures/sample-module/module-graph.json',
  baseUrl: '/ms'
});

var app = express();
app.listen(1337);

console.log('Module server running at http://127.0.0.1:1337/ms/');

//to do: use express.static?
app.get('/', function (req, res, next) {
  fs.readFile(__dirname + '/clients/test/demo.html', 'utf8', function (err, file) {
    if(err) {
      return next(err);
    }
    res.writeHead(200, {
      'Content-Length': file.length,
      'Content-Type': 'text/html'
    });
    res.end(file, 'utf8');
  });
});

app.use(httpServer);
