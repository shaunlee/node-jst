var test = require('node:test'),
    assert = require('node:assert'),
    path = require('path');

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
      assert.match(page, /Template powered by node-jst\./, 'the partial');
      assert.match(page, /你好 JST/, 'gettext');
      assert.match(page, /有3辆车/, 'ngettext, plural');

      var english = await (await fetch(base + '/?lang=en')).text();
      assert.match(english, /There are 3 cars/);

      var css = await (await fetch(base + '/stylesheets/style.css')).text();
      assert.match(css, /^body \{/, 'static files');
    } finally {
      server.close();
    }
  });
}
