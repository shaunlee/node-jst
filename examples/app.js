
/**
 * Module dependencies.
 */

var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    jst = require('..');   // `require('jst')` in your own app

var app = module.exports = express();

// Configuration

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jst');
app.engine('jst', jst.renderFile);

// Skip the stat() before every render once the views stop changing.
if (app.get('env') === 'production') jst.configure({cache: true});

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(express.static(path.join(__dirname, 'public')));

// i18n
//
// Just enough of a message catalogue to show how per-request helpers reach a
// template; a real app would use an i18n package for this.

var catalogs = {};

function catalog(lang) {
  if (!(lang in catalogs)) {
    var file = path.join(__dirname, 'locales', lang + '.json');
    catalogs[lang] = fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, 'utf8'))
      : {};
  }
  return catalogs[lang];
}

function format(str, args) {
  return str.replace(/\{(\w+)\}/g, function(all, key) {
    return key in args ? args[key] : all;
  });
}

// Anything on res.locals is visible to the template. Try /?lang=en.
app.use(function(req, res, next) {
  var messages = catalog(req.query.lang || 'zh_CN');

  res.locals._ = function(str, args) {
    return format(messages[str] || str, args || {});
  };

  res.locals._n = function(one, many, n) {
    var str = n === 1 ? one : many;
    return format(messages[str] || str, {n: n});
  };

  next();
});

// Views
//
// Express dropped layouts and partials in 3.x and jst has no view inheritance
// of its own, so the two views are composed here instead.

app.locals.partial = function(name) {
  var file = path.join(app.get('views'), '_' + name + '.jst');
  return jst.render(fs.readFileSync(file, 'utf8'), app.locals);
};

function renderPage(res, next, view, options) {
  res.render(view, options, function(err, body) {
    if (err) return next(err);
    res.render('layout', Object.assign({body: body}, options));
  });
}

// Routes

app.get('/', function(req, res, next){
  renderPage(res, next, 'index', {
    title: 'Express'
  });
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", 3000);
}
