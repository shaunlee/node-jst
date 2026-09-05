var test = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    path = require('path'),
    jst = require('../index');

// The example carries the only end-to-end wiring of the engine into express,
// and went unnoticed for years after express removed the APIs it used.
var app;
try {
  app = require('../examples/app');
} catch (e) {
  if (e.code !== 'MODULE_NOT_FOUND') throw e;
  test('example app', {skip: 'run npm install first'}, function() {});
}

if (app) {
  test('the example app renders its page', async function() {
    var server = app.listen(0),
        base = 'http://localhost:' + server.address().port;

    try {
      var page = await (await fetch(base + '/')).text();

      assert.match(page, /<title>Express<\/title>/);
      assert.match(page, /<h1>Express<\/h1>/, 'the view');
      assert.match(page, /<li>one<\/li>\s*<li>two<\/li>/, 'a code block');
      assert.match(page, /&lt;b&gt;this&lt;\/b&gt;/, 'the e filter');
      assert.match(page, /5 stars/, 'the add filter');
      assert.match(page, /<pre>\n  one\n    two\n<\/pre>/, '<pre> is not minified');
      assert.match(page, /Template powered by node-jst\./, 'the partial');

      var css = await (await fetch(base + '/stylesheets/style.css')).text();
      assert.match(css, /^body \{/, 'static files');
    } finally {
      server.close();
    }
  });

  test('the example views take the with(it)-free fast path', function() {
    var views = path.join(__dirname, '..', 'examples', 'views');

    fs.readdirSync(views).forEach(function(name) {
      var src = fs.readFileSync(path.join(views, name), 'utf8');
      assert.equal(/with\(it\)/.test(jst.compile(src, true)), false, name);
    });
  });
}
