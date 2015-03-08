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

There's a bit of magic happening with regards to `ModuleServer.m`:
- after a module is loaded all success callbacks are called with the module's contents:
  `cb(ModuleServer.m[module])`
- however, ModuleServer.m is never set in this file
- therefore, the dependencies that are fetched over the network must register themselves
  on ModuleServer.m
Q: why doesn't `ModuleServer` register the modules in `m`?

*/


/**
 * Creates a Module loader.
 * USAGE:
 *   window.loadModule = ModuleServer('http://url./of/your/module/server/');
 *   loadModule('your/module', function(yourModule) { … });
 * @param {string} urlPrefix URL prefix of your module server.
 * @param {function(string,Function)=} fetch OPTIONAL function to fetch JS
 *     from a given URL, that fires a callback when the JS fetched. If
 *     you do not provide this function, you need to include $LAB.js in the
 *     current page. If you want to implement your own fetcher, make sure it
 *     supports executing JS in fetch order (ideally without blocking).
 * @param {Function=} getUrl OPTIONAL function to create a URL given the
 *     urlPrefix, the current module name and a list of modules that have
 *     already been requested. You will need to provide this if your server
 *     does not follow the conventions of demo-server.js.
 * @return {function(string, function(*)=)} Returns a function to load modules
 *     The first param is the name of the module and the second param is a
 *     callback that fires when the module loaded. It received the exports
 *     object of the module as its first param.
 */
function ModuleServer(urlPrefix, fetch, getUrl) {
  if (!urlPrefix) {
    urlPrefix = './';
  }

  if (!fetch) {
    // Provide a default load function. This function assumes that $LAB.js is
    // present in the current page.
    (function() {
      var lab = window.$LAB;
      fetch = function(url, cb) {
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
    this.requestedModules = []; //modules that have been requested
    this.fetched = {}; //modules that have been successfully loaded
    this.fetchCallbacks = {}; //module callbacks that need to be called once the module is fetched
  };

  Server.prototype.load = function(module, cb) {
    var self = this;
    module = 'module$' + module.replace(/\//g, '$'); // to create unambiguous query params: `/` -> `$`
    //a module is already fetched in case:
    // - `module` was explicitly fetched, stored by name in `this.fetched`
    // - `module` was fetched as a dependency, stored in `ModuleServer.m`

    //`m` not a property of this (`instance.load`) or `fetched` a property of `ModuleServer`, because:
    //- fetched modules register themselves in `ModuleServer.m`
    //- loaded modules don't have access to context of this (`instance.load`)

    //Q: why keep track of `this.fetched` if it's a subset of `ModuleServer.m`?
    if (this.fetched[module] || ModuleServer.m[module]) {
      if (cb) {
        cb(ModuleServer.m[module]);
      }
      return;
    }

    //make sure there's always a callback, even if it does nothing
    //if the user provided a callback, call it with the module that was requested
    var userCb = cb;
    cb = function() {
      if (userCb) {
        userCb(ModuleServer.m[module]);
      }
    };

    //if the module is already requested, queue the callback
    if (this.fetchCallbacks[module]) {
      this.fetchCallbacks[module].push(cb);
      return;
    }
    //store callback in array, to be added to when module is requested again before it's fetched
    this.fetchCallbacks[module] = [cb];

    var before = this.requestedModules.slice(); //copy the array
    this.requestedModules.push(module);
    //Q: should this be moved to fetch callback?
    //- module A and B, B has a dependency on A
    //- A is requested slightly before B
    //- A is registered as requested, therefore excluded when B is requested
    //- B is fetched before A, callbacks are called but A is not yet fetched
    //- error?

    //when the module and its dependecies are fetched, execute the callbacks
    fetch(getUrl(this.urlPrefix, module, before), function() { //Q: why no error handling?
      var cbs = self.fetchCallbacks[module];
      self.fetched[module] = true;
      self.fetchCallbacks[module] = null;

      for (var i = 0; i < cbs.length; i++) {
        cbs[i]();
      }
    });
  };

  var instance = new Server(urlPrefix);
  //to separate private/public props, create wrapper function so that `instance` isn't exposed
  function loadModule(module, cb) {
    instance.load(module, cb);
  }
//  loadModule.instance = instance; //it's unclear to me why you'd want to expose instance after just wrapping it
  return loadModule;
}

// Registry for fetched modules.
ModuleServer.m = {};
// I don't know why modules are stored globally in ModuleServer.m, but:
// - $LAB loads a module (with its dependencies) in a single request
// - the response contains js that sets itself (module+dependencies) on ModuleServer.m

//in case this file is loaded as a commonJS module, export it
if (typeof exports !== 'undefined') {
  exports.ModuleServer = ModuleServer;
}
