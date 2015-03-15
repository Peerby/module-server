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

var http = require('http');
var fs = require('fs');

var config = require('./config');
var ModuleServer = require('../module-server');

ModuleServer.from(config.SOURCE_DIR + '/../build',
    config.SOURCE_DIR + '/module-graph.json', run);

function run(err, moduleServer) {
  if (err) {
    throw err;
  }

  var server = http.createServer(httpServer);
  server.listen(1337, '127.0.0.1');
  console.log('Module server running at http://127.0.0.1:1337/');

  function httpServer (req, res) {
    var url = require('url').parse(req.url);
    console.log('--------------------------\nurl.pathname', url.pathname);
    // Load static files for demo
    var staticPaths = {
      '/index.html': function () {
        fs.readFile(__dirname + '/client/index.html', 'utf8', function (err, html) {
          if(err) {
            throw err;
          }
          res.writeHead(200, {
            'Content-Type': 'text/html',
            'Content-Length': html.length
          });
          res.end(html, 'utf8');
        });
        return;
      },
      '/third-party/LABjs/LAB.src.js': function () {
        fs.readFile(__dirname + '/client/js/third-party/LABjs/LAB.src.js', 'utf8', function (err, js) {
          if(err) {
            throw err;
          }
          res.writeHead(200, {
            'Content-Type': 'application/javascript',
          });
          res.end(js, 'utf8');
        });
      },
      '/third-party/module-server/module-client.js': function () {
        fs.readFile(__dirname + '/client/js/third-party/module-server/module-client.js', 'utf8', function (err, js) {
          if(err) {
            throw err;
          }
          res.writeHead(200, {
            'Content-Type': 'application/javascript',
          });
          res.end(js, 'utf8');
        });
      }
    };

    var staticPath = staticPaths[url.pathname];
    if (staticPath) {
      return staticPath();
    }

    //return original source when browser requests it (through source mapping)
    var isOriginalSourceRequest = config.ORIGINAL_SOURCE_PATH_PREFIX_REGEX.test(url.pathname);
    if (isOriginalSourceRequest) {
      var filename = config.SOURCE_DIR + '/' + url.pathname
          .replace(config.ORIGINAL_SOURCE_PATH_PREFIX_REGEX, '');
      console.log('Original source request for file', filename);
      return fs.readFile(filename, 'utf8', function(err, js) {
        if (err) {
          throw err;
        }
        res.writeHead(200, {
          'Content-Type': 'application/javascript',
          'Content-Length': js.length,
          'Pragma': 'no-cache'
        });
        res.end(js, 'utf8');
      });
    }

    //determine if it's a request for a source map
    var isSourceMapRequest = false;
    if (config.SOURCEMAP_PATH_PREFIX_REGEX.test(url.pathname)) {
      isSourceMapRequest = true;
      url.pathname = url.pathname.replace(config.SOURCEMAP_PATH_PREFIX_REGEX, '/');
    }

    //retrieve module and its dependencies and return in single response
    jsForPath(url.pathname, isSourceMapRequest, function(err, length, js,
        sourceMap) {
      if (err) {
        console.log('Error', err);
        if (err.statusCode) {
          res.writeHead(err.statusCode, {'Content-Type': 'text/plain'});
          res.end(err.message);
        } else {
          res.writeHead(500, {'Content-Type': 'text/plain'});
          res.end('Internal server error');
        }
        return;
      }

      if (isSourceMapRequest) {
        console.log('source map request, returning',sourceMap);
        var map = JSON.stringify(sourceMap, null, ' ');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': map.length,
          'Pragma': 'no-cache'
        });
        res.end(map, 'utf8');
        return;
      }

      var mapUrl = config.SOURCEMAP_PREFIX + url.pathname;
      console.log('module request', mapUrl);
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Content-Length': length,
        'SourceMap': mapUrl,
        'X-SourceMap': mapUrl
      });
      res.end(js, 'utf8');
    });
  }

  //loads module and its dependencies
  //this should be part of module-server because it's not application specific
  function jsForPath (path, isSourceMapRequest, cb) {
    path = path.replace(/^\//, '');
    var parts = path.split(/\//);
    var modules = decodeURIComponent(parts.shift()).split(/,/);
    
    //an options object is built so that exm property can be checked for, however:
    //don't know where .exm comes from because it's not present anywhere else in the project
    //perhaps it serves a purpose not demonstrated in this demo
    //`exclude` is therefore always null
    //logically however it should be part of the demo because the whole point
    //is that it doesn't load any dependencies that are already loaded on the client
    var options = {};
    parts.forEach(function(part) {
      var pair = part.split(/=/);
      options[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    });
    var exclude = null;
    if(options.exm) {
      exclude = options.exm.split(/,/);
    }

    //load modules that are requested by client and call cb
    moduleServer(modules, exclude, {
      createSourceMap: isSourceMapRequest,
      sourceMapSourceRootUrlPrefix: config.ORIGINAL_SOURCE_PATH_PREFIX,
      debug: true,
      onLog: function() {
        console.log(arguments);
      }
    }, cb);
  }
}
