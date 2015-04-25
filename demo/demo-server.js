////////////////////
//code that uses http-server

var express = require('express');
var fs = require('fs');
var httpServer = require('../http-server')({
  sourceDir: '/demo/client/js',
  buildDir: '/demo/client/build',
  moduleGraphFile: '/demo/client/js/module-graph.json',
  baseUrl: '/ms'
});

var app = express();
app.listen(1337);

console.log('Module server running at http://127.0.0.1:1337/ms/');

//to do: use express.static?
app.get('/', function (req, res, next) {
  fs.readFile(__dirname + '/client/index.html', 'utf8', function (err, file) {
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
