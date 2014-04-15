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

This file should be included on the client when you want to load modules from the module server.

`ModuleServer(<module server url>)` returns function `load` which is called with two params:
- path to the module you want to load
- callback, called once it's loaded (with the module as its only argument, no error handling)

When ModuleServer goes to the module server and asks for the module,
it also includes which modules it has requested before.
The module server knows the dependency tree, therefore
it is able to figure out what dependencies are still missing on the client.
It sends the module back together with the missing dependencies.

When the module has loaded, the module is ready to be executed,
and one or more load() callbacks are executed.
(in case the module was requested more than once before it loaded)

*/


/**
 * Creates a Module loader.
 * USAGE:
 *   window.loadModule = ModuleServer('http://url./of/your/module/server/');
 *   loadModule('your/module', function(yourModule) { … });
 * @param {string} urlPrefix URL prefix of your module server.
 * @param {function(string,Function)=} load OPTIONAL function to load JS
 *     from a given URL, that fires a callback when the JS loaded. If
 *     you do not provide this function, you need to include $LAB.js in the
 *     current page. If you want to implement your own loader, make sure it
 *     supports executing JS in load order (ideally without blocking).
 * @param {Function=} getUrl OPTIONAL function to create a URL given the
 *     urlPrefix, the current module name and a list of modules that have
 *     already been requested. You will need to provide this if your server
 *     does not follow the conventions of demo-server.js.
 * @return {function(string, function(*)=)} Returns a function to load modules
 *     The first param is the name of the module and the second param is a
 *     callback that fires when the module loaded. It received the exports
 *     object of the module as its first param.
 */
function ModuleServer(urlPrefix, load, getUrl) {
  if (!urlPrefix) {
    urlPrefix = './';
  }

  if (!load) {
    // Provide a default load function. This function assumes that $LAB.js is
    // present in the current page.
    (function() {
      var lab = window.$LAB;
      load = function(url, cb) {
        console.log('LABjs loading url', url);
        lab.script(url).wait(cb);
      };
    })();
  }

  if (!getUrl) {
    getUrl = function(urlPrefix, module, requested) {
      return urlPrefix.replace(/\/$/, '') + '/' + encodeURIComponent(module) +
          (requested.length > 0 ? '/' + encodeURIComponent(
              requested.sort().join(',')) : '');
    };
  }

  var Server = function(urlPrefix) {
    this.urlPrefix = urlPrefix;
    this.requested = {};
    this.requestedList = [];
    this.loaded = {};
  };

  Server.prototype.load = function(module, cb) {
    var self = this;
    module = 'module$' + module.replace(/\//g, '$');
    //a module is already loaded when:
    // - because this function explicitly (this.loaded) was called and `module` is loaded
    // - `module` is loaded earlier as a dependency. ModuleServer.m[module] got set in the earlier js payload
    if (this.loaded[module] || ModuleServer.m[module]) {
      if (cb) {
        cb(ModuleServer.m[module]);
      }
      return;
    }
    var userCb = cb;
    cb = function() {
      if (userCb) {
        userCb(ModuleServer.m[module]);
      }
    };
    //if already requested, attach callback
    if (this.requested[module]) {
      this.requested[module].push(cb);
      return;
    }

    var before = this.requestedList.slice(); //copy the array
    this.requestedList.push(module);
    var cbs = this.requested[module] = [cb]; //creating local reference to cbs for quicker lookup

    //when the module and its dependecies are loaded, execute the callbacks
    load(getUrl(this.urlPrefix, module, before), function() {
      self.loaded[module] = true;
      self.requested[module] = null;
      for (var i = 0; i < cbs.length; i++) {
        cbs[i]();
      }
    });
  };

  var instance = new Server(urlPrefix);
  function loadModule(module, cb) {
    instance.load(module, cb);
  };
  loadModule.instance = instance;
  return loadModule;
}

// Registry for loaded modules.
ModuleServer.m = {};
// I don't know why modules are stored globally in ModuleServer.m, but:
// - $LAB loads a module (with its dependencies) in a single request
// - the response contains js that sets itself (module+dependencies) on ModuleServer.m
// Perhaps because of default behavior of $LAB, ModuleServer needs to be defined globally

if (typeof exports != 'undefined') {
  exports.ModuleServer = ModuleServer;
}
