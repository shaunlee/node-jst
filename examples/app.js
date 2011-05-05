
/**
 * Module dependencies.
 */

var express = require('express'),
    jst = require('jst');

var app = module.exports = express.createServer();

// Configuration

jst.configure({
  locales: {locales: __dirname + '/locales'}
});

app.configure(function(){
  app.set('views', __dirname + '/views');
  //app.set('view engine', 'jst');
  app.register('.html', jst); // Use this for i18n
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(function(req, res, next) { req.lang = 'zh_CN'; next(); });
  app.use(jst.detector);
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

app.get('/', function(req, res){
  res.render('index.html', {
    title: 'Express'
  });
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", app.address().port);
}
