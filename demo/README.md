goal
-----------

- show how module-server works in practice
- figure out if/how parts of `/demo-server.js` needs to abstracted into the library

start
-----------

- in the build step, the source tree gets compiled, sources are minified and source maps
  are generated. `module-compiler` is a process that does this and watches the directory
  for changes to recompile. Run the following in the root of the project:
  
  `node module-compiler/bin.js --module_path=demo/js --entry_module=index --output_path=../build/`

what does it do
-----------

- simple SPA
- bootstraps first view and dependencies
- other views loaded via `module-server`