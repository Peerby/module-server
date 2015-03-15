goal
-----------

- show how module-server works in practice
- figure out if/how parts of `/demo-server.js` needs to abstracted into the library

start
-----------

- make sure all dependencies are downloaded, run:

 `npm install`, both in `/` and in `/module-compiler`

- in the build step, the source tree gets compiled, sources are minified and source maps
  are generated. `module-compiler` is the process that does this and watches the directory
  for changes to recompile. Run the following in the root of the project:
  
  `node module-compiler/bin.js --module_path=demo/client/js --entry_module=index --output_path=../build/`

- the web server serves all files the client needs. Run the following in the root of the project:

  `node demo/demo-server`

- in the browser, open the page:

  `http://127.0.0.1:1337/`

what does it do
-----------

- simple SPA
- bootstraps first view and dependencies
- other views loaded via `module-server`