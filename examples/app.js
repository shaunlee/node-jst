
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

app.use(express.static(path.join(__dirname, 'public')));

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
    title: 'Express',
    items: ['one', 'two', 'three'],
    comment: 'markup like <b>this</b> & this is escaped by |e',
    stars: 4
  });
});

// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", 3000);
}
