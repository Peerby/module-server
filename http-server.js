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

/*
  TODO:
  - use options in http-server
  - use (over-writable) namespacing routing to prevent conflicts/improve speed
  - clean up code
  - test

*/

var debug = require('debug')('module-server');
var fs = require('fs');

var ModuleServer = require('./module-server');

module.exports = function httpServer(options) {
  var staticServer;
  var loadJsForPath;
  var moduleServer;

  options = options || {};

  //check required options
  if (!options.sourceDir) {
    throw new Error('missing `sourceDir`');
  }
  if (!options.buildDir) {
    throw new Error('missing `buildDir`');
  }
  if (!options.moduleGraphFile) {
    throw new Error('missing `moduleGraphFile`');
  }

  options.baseUrl = options.baseUrl || '';
  //format baseUrl
  if (options.baseUrl) {
    if(options.baseUrl[0] !== '/') { //start with /
      options.baseUrl = '/' + options.baseUrl;
    }
    if(options.baseUrl.slice(-1) === '/') { //end without /
      options.baseUrl = options.baseUrl.slice(0, -1);
    }
  }

  var config = {
    fs: {
      sourceDir: __dirname + options.sourceDir,
      buildDir: __dirname + options.buildDir,
      moduleGraphFile: __dirname + options.moduleGraphFile,
    },
    urls: {
      base: options.baseUrl,
      baseRegex: getUrlRegex(options.baseUrl + '/'),
      sourceMapPrefix: options.baseUrl + '/_sourcemap',
      sourceMapPrefixRegex: getUrlRegex(options.baseUrl + '/_sourcemap/'),
      originalPrefix: options.baseUrl + '/_js',
      originalPrefixRegex: getUrlRegex(options.baseUrl + '/_js/')
    }
  };

  debug('config', config);
  ModuleServer.from(config.fs.buildDir, config.fs.moduleGraphFile, function (err, _moduleServer) {
    if (err) {
      throw err;
    }
    moduleServer = _moduleServer;
    loadJsForPath = jsPathLoader(moduleServer, config);
  });

  staticServer = createStaticServer(options.baseUrl);
  staticServer.use('/third-party/LABjs/LAB.src.js', '/clients/third-party/LABjs/LAB.src.js', {
    'Content-Type': 'application/javascript'
  });
  staticServer.use('/module-client.js', '/clients/module-client.js', {
    'Content-Type': 'application/javascript'
  });

  //return middleware
  return function (req, res, next) {
    if (!moduleServer) {
      debug('module server is not loaded yet');
      return next('module server not loaded yet');
    }

    var url = require('url').parse(req.url);
    debug('\nincoming request', decodeURIComponent(url.pathname));
    // Load static files for demo

    if (!url.pathname.match(config.urls.baseRegex)) {
      debug('does not match ' + config.urls.baseRegex);
      res.writeHead(404, {'Content-Type': 'text/plain'});
      return res.end('File not found');
    }

    var staticPath = staticServer.isStatic(url.pathname);
    if (staticPath) {
      debug('serving static file');
      return staticPath(req, res, next);
    }

    //return original source when browser requests it (through source mapping)
    var originalSourceRequest = originalPath(url.pathname, config);
    if (originalSourceRequest) {
      debug('serving original source file');
      return originalSourceRequest(req, res, next);
    }

    //determine if it's a request for a source map
    var isSourceMapRequest = false;
    if (config.urls.sourceMapPrefixRegex.test(url.pathname)) {
      isSourceMapRequest = true;
      url.pathname = url.pathname.replace(config.urls.sourceMapPrefixRegex, '/');
    }

    //retrieve module and its dependencies and return in single response
    return loadJsForPath(url.pathname, isSourceMapRequest, serveJs);

    function serveJs(err, length, js, sourceMap) {
      if (err) {
        debug('error serving modules', err);
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
        debug('serving source map');
        var map = JSON.stringify(sourceMap, null, ' ');
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Length': map.length,
          'Pragma': 'no-cache'
        });
        res.end(map, 'utf8');
        return;
      }

      var mapUrl = config.urls.sourceMapPrefix + url.pathname;
      debug('serving module(s)');
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Content-Length': length,
        'SourceMap': mapUrl,
        'X-SourceMap': mapUrl
      });
      res.end(js, 'utf8');
    }
  };
};

function jsPathLoader (moduleServer, config) {
  //loads module and its dependencies
  //this should be part of module-server because it's not application specific

  return function loadJsForPath (path, isSourceMapRequest, cb) {
    path = path.replace(config.urls.baseRegex, '');
    var parts = path.split(/\//);
    var modules = decodeURIComponent(parts.shift()).split(/,/);
    var exclude = null;
    if (parts.length) {
      exclude = decodeURIComponent(parts.shift()).split(/,/);
    }

    //load modules that are requested by client and call cb
    moduleServer(modules, exclude, {
      createSourceMap: isSourceMapRequest,
      sourceMapSourceRootUrlPrefix: config.urls.originalPrefix,
      debug: true,
      onLog: function() {
        var args = Array.prototype.slice.call(arguments);
        debug(args.join(' '));
      }
    }, cb);
  };
}

function createStaticServer (baseUrl) {
  var staticPaths = {};

  return {
    use: loadStatic,
    isStatic: isStatic
  };

  function loadStatic (urlPath, filePath, headers) {
    staticPaths[baseUrl + urlPath] = function (req, res, next) {
      fs.readFile(__dirname + filePath, 'utf8', function (err, file) {
        if(err) {
          return next(err);
        }
        res.writeHead(200, headers);
        res.end(file, 'utf8');
      });
    };
  }

  function isStatic (urlPath) {
    var staticPath = staticPaths[urlPath];
    if (staticPath) {
      return staticPath;
    }
  }
}

function originalPath (urlPath, config) {
  if (!config.urls.originalPrefixRegex.test(urlPath)) {
    return;
  }

  return function (req, res, next) {
    var filename = config.fs.sourceDir + '/' + urlPath.replace(config.urls.originalPrefixRegex, '');
    return fs.readFile(filename, 'utf8', function(err, js) {
      if (err) {
        debug('error serving original source file', err);
        if (err.statusCode) {
          res.writeHead(err.statusCode, {'Content-Type': 'text/plain'});
          res.end(err.message);
        } else {
          res.writeHead(500, {'Content-Type': 'text/plain'});
          res.end('Internal server error');
        }
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/javascript',
        'Content-Length': js.length,
        'Pragma': 'no-cache'
      });
      res.end(js, 'utf8');
    });
  };
}

function getUrlRegex(url) {
  if (url[0] !== '/') {
    url = '/' + url;
  }
  url = '^' + url;
  return new RegExp(url);
}

