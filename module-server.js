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

the module server serves js files; it uses a module graph which is loaded from the beginning.
The actual module graph itself, is built by the closure compiler.
The graph is used to build module list in memory

When the server is created, it provides a function to load modules.
An array of strings of $ separated module paths will cause the relevant modules to be loaded.
They are concatenated into a single js file that contains the module and its dependencies.

In case the a source map is requested, the function also returns the sourceMap as the last argument.

*/

var path = require('path');
var fs = require('fs');
var Graph = require('./module-graph');

function JsModuleFile(pathPrefix, name, onSource, onSourceMap) {
  var self = this;
  self.filename = path.join(pathPrefix, name + '.js');
  self.js = null;
  self.map = null;
  fs.readFile(this.filename, 'utf8', function(err, data) {
    if (err) {
      return onSource(err);
    }
    self.js = data;
    onSource(null, self);
  });
  fs.readFile(this.filename + '.map', 'utf8', function(err, data) {
    if (err) {
      return onSourceMap(err);
    }
    self.map = data;
    onSourceMap(null, self);
  });
}

JsModuleFile.prototype.getNumberOfLines = function() {
  return this.js.split(/\n/).length;
};

JsModuleFile.prototype.getMap = function() {
  // Return a fresh copy every time.
  return JSON.parse(this.map);
};

function makeServer(graph, modules) {
  return function loadModules(moduleNames, excludeNames, options, cb) {
    options = options || {};
    var debug = options.debug;
    var log = options.onLog || function() {};
    var createSourceMap = !!options.createSourceMap;
    log('Module request', moduleNames, excludeNames);
    try {
      var names = graph.getModules(moduleNames, excludeNames);
    } catch(e) {
      return cb(e);
    }
    log('Serving modules', names);
    var js = '';
    var lineNumber = 1;
    var sourceMapSections = createSourceMap ? [] : null;
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (debug) {
        js += '/* Module: ' + name + ' */\n';
        lineNumber++;
      }
      var file = modules[name];
      js += file.js + '\n';
      js += 'ModuleServer.m.' + name + '=' + name + ';\n';
      if (createSourceMap) {
        var map = file.getMap();
        map.sourceRoot = options.sourceMapSourceRootUrlPrefix;
        sourceMapSections.push({
          offset: {
            line: lineNumber,
            column: 0, // That is why we always add an extra line.
          },
          map: map
        });
        lineNumber = lineNumber + file.getNumberOfLines() + 1;  // The ModuleServer.m… line;
      }
    }
    var sourceMap = createSourceMap ? {
      version: 3,
      file: "just-the-container.js",
      sections: sourceMapSections
    } : null;
    cb(null, js.length, js, sourceMap);
  };
}

/**
 * Make a module server that serves JS from memory and loads it from disk.
 * @param {string} pathPrefix Directory where JS files can be found. JS files
 *     are expected to be pathPrefix + name + '.js'
 * @param {string} graphFilename Filename of a module graph serialization.
 * @param {function(Error,function(Array.<string>,Array.<string>,
 *     function(Error,number,string),Object))} initCompleteCb Callback to be
 *     fired when the server is ready.
 * @return {*}
 */
exports.from = function(pathPrefix, graphFilename, initCompleteCb) {
  Graph.fromFilename(graphFilename, function(err, graph) {
    if (err) {
      return initCompleteCb(err);
    }
    var modules = {};
    var allModules = graph.getAllModules();
    allModules.forEach(function(name) {
      modules[name] = new JsModuleFile(pathPrefix, name, onFile, onFile);
    });

    var fn = makeServer(graph, modules);
    fn.NotFoundException = graph.NotFoundException;

    var loaded = 0;
    //generic callback that is called once source or sourcemap is loaded
    //if for each module both are loaded (length * 2), the module server is initialized
    //and ready to load modules
    function onFile(err) {
      if (err) {
        return initCompleteCb(err);
      }
      if (++loaded == allModules.length * 2) {
        initCompleteCb(null, fn);
      }
    }
  });
};
