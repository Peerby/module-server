client
=========

module-client
------------

- exposes load function which loads a module and its dependencies in one single HTTP request
- only files that are not yet loaded in the client are requested from the backend


server
=========

demo-server
------------

- requires module-server, instantiates it with path to built module graph json file
- when module-server is ready, creates http server
- http server listens for different routes to server js and js maps

module-server
-----------

- requires module-graph, to determine which dependencies should be loaded
- loads requested modules based on module graph
- returns dependencies as concatenated String
- includes optional source map

module-graph
-----------

- interprets closure-compiled dependency graph
- returns delta between required modules and excluded modules and their
  (transitive) dependencies


module-compiler
=========

- running closure compiler to minify js, create source maps and dependency graph



general
============

- there a two types of requiring modules:
  - synchronous / `require`: all occurences of require() are replaced by Closure compiler with
    references to the modules. there's no IO, because the dependency is guaranteed to
    be available because it was either already present or it came along with the same
    HTTP request. All `require` dependencies of a module are available to the module
    when it is run.
  - asynchronous / `ModuleServer('url')`: if you want to postpone loading a module because you don't
    need it immediately, you fetch it via the module loader that is present on the
    client. 
- the effect of these two types of module loading is that it creates a convention for
  the developer to separate two types of 'dependencies':
  - dependencies that are necessary for the module to function
  - other modules that are needed later
- in the latter case, module A depends on B from an UX perspective (even though there's
  decoupling in the code). So, a dependency is the sense of, if you click the 'chat' 
  button, an event is triggered on the routing and the 'chat module' is loaded.


TODO
==========

- source maps are broken

- to make this project a drop-in solution, parts of demo-server should be included 
  in a library, resulting in two files with different responsibilities:
  - module-server.js: general serving of module-server files, that would be required 
    in each project: js, js maps, module-client.js, LABjs (existing module-server.js
    should be renamed to module-loader.js)
  - demo-server.js: app specific serving of files, demo.html

- serve a minified module-client

- write express integration
  √ better error handling
  √ better configurable
  √ clean up code
  √ supports url prefixing for namespacing module-server
  - use in demo/ (move /demo-server.js to demo/)

- add support for `module.exports` (now only `exports`)

- create script that watches for file changes and sequentially:
  - builds with module-compiler
  - reboots web server