var test = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    os = require('os'),
    path = require('path'),
    jst = require('../index');

var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-test-'));

function tmpfile(name, ctx) {
  var p = path.join(tmp, name);
  fs.writeFileSync(p, ctx, 'utf8');
  return p;
}

// --- compile / render basics ---


test('interpolates with `with(it)` scoping', function() {
  assert.equal(jst.render('Hello {{ name }}', {name: 'jst'}), 'Hello jst');
});

test('interpolates with the `it.` prefix', function() {
  assert.equal(jst.render('Hello {{ it.name }}', {name: 'jst'}), 'Hello jst');
});

test('the two variable styles do not leak into each other', function() {
  assert.equal(jst.render('a{{ it.x }}', {x: 1}), 'a1');
  assert.equal(jst.render('b{{ x }}', {x: 2}), 'b2');
  assert.equal(jst.render('c{{ it.x }}', {x: 3}), 'c3');
});

test('interpolation at the very start and end of a template', function() {
  assert.equal(jst.render('{{ a }}', {a: 'x'}), 'x');
  assert.equal(jst.render('{{ a }}{{ b }}', {a: 'x', b: 'y'}), 'xy');
});


test('code blocks can branch on data', function() {
  var t = '{% if (user) { %}<h2>{{ user.name }}</h2>{% } %}';
  assert.equal(jst.render(t, {user: {name: 'jst'}}), '<h2>jst</h2>');
  assert.equal(jst.render(t, {user: null}), '');
});


test('compile returns a reusable function', function() {
  var fn = jst.compile('Hello {{ it.name }}');
  assert.equal(fn({name: 'a'}), 'Hello a');
  assert.equal(fn({name: 'b'}), 'Hello b');
});

test('compile(ctx, true) returns source code', function() {
  var code = jst.compile('Hello {{ it.name }}', true);
  assert.equal(typeof code, 'string');
  assert.match(code, /^function\(it\)/);
});

// --- text escaping in the generated code ---

test('literal double quotes survive', function() {
  assert.equal(jst.render('say "hi" {{ a }}', {a: 1}), 'say "hi" 1');
});


// --- filters ---

test('escape filter', function() {
  assert.equal(jst.render('{{ it.v|e }}', {v: '<b>&</b>'}), '&lt;b&gt;&amp;&lt;/b&gt;');
});


test('escape filter passes non-strings through', function() {
  assert.equal(jst.render('{{ it.v|e }}', {v: 42}), '42');
});

test('parameterised filter', function() {
  assert.equal(jst.render('{{ it.value|add(123) }}', {value: 123}), '246');
});

test('chained filters', function() {
  assert.equal(jst.render('{{ it.v|e|linebreaksbr }}', {v: '<a>\nb'}),
    '&lt;a&gt;<br>\nb');
});

test('addFilter registers a custom filter', function() {
  jst.addFilter('twice', function(src) { return String(src) + String(src); });
  assert.equal(jst.render('{{ it.v|twice }}', {v: 'ab'}), 'abab');
});

test('addFilters registers several custom filters', function() {
  jst.addFilters({
    up: function(src) { return String(src).toUpperCase(); },
    down: function(src) { return String(src).toLowerCase(); }
  });
  assert.equal(jst.render('{{ it.v|up }}{{ it.v|down }}', {v: 'aB'}), 'ABab');
});

// --- compiler state must not leak between calls ---

test('a failed compile does not corrupt the next one', function() {
  assert.throws(function() { jst.compile('{{ ( }}'); });
  assert.equal(jst.render('ok {{ it.a }}', {a: 1}), 'ok 1');
});

// --- caching ---

test('rendering the same template twice gives the same result', function() {
  var t = 'x{{ it.a }}y';
  assert.equal(jst.render(t, {a: 1}), 'x1y');
  assert.equal(jst.render(t, {a: 2}), 'x2y');
});

// --- renderFile ---

test('renderFile renders a file', function(t, done) {
  var p = tmpfile('a.jst', 'Hello {{ it.name }}');
  jst.renderFile(p, {name: 'jst'}, function(err, out) {
    assert.ifError(err);
    assert.equal(out, 'Hello jst');
    done();
  });
});

test('renderFile treats args as optional', function(t, done) {
  var p = tmpfile('b.jst', 'static');
  jst.renderFile(p, function(err, out) {
    assert.ifError(err);
    assert.equal(out, 'static');
    done();
  });
});

test('renderFile reports a missing file', function(t, done) {
  jst.renderFile(path.join(tmp, 'nope.jst'), {}, function(err) {
    assert.ok(err);
    done();
  });
});

test('renderFile serves repeated renders from cache', function(t, done) {
  var p = tmpfile('c.jst', '{{ it.a }}');
  jst.renderFile(p, {a: 1}, function(err, first) {
    assert.ifError(err);
    assert.equal(first, '1');
    jst.renderFile(p, {a: 2}, function(err, second) {
      assert.ifError(err);
      assert.equal(second, '2');
      done();
    });
  });
});

test('renderFile picks up a changed file', function(t, done) {
  var p = tmpfile('d.jst', 'v1');
  jst.renderFile(p, {}, function(err, first) {
    assert.ifError(err);
    assert.equal(first, 'v1');
    setTimeout(function() {
      tmpfile('d.jst', 'v2');
      jst.renderFile(p, {}, function(err, second) {
        assert.ifError(err);
        assert.equal(second, 'v2');
        done();
      });
    }, 20);
  });
});




test('renderFile stays asynchronous on a cache hit', function(t, done) {
  var p = tmpfile('g.jst', 'sync?'),
      sync = true;
  jst.renderFile(p, {}, function() {
    jst.configure({cache: true});
    jst.renderFile(p, {}, function(err, out) {
      jst.configure({cache: false});
      assert.ifError(err);
      assert.equal(out, 'sync?');
      assert.equal(sync, false, 'callback must not fire synchronously');
      done();
    });
    sync = false;
  });
});

// --- minifying must not corrupt code or preformatted text ---



test('multi-line comments are stripped', function() {
  assert.equal(jst.render('a{#\n  gone\n#}b', {}), 'ab');
});

test('layout whitespace is collapsed', function() {
  assert.equal(jst.render('<p>\n  a\n</p>', {}), '<p>  a</p>');
});




test('an empty template renders an empty string', function() {
  assert.equal(jst.render('', {}), '');
  assert.equal(jst.render('{% var i = 0 %}', {}), '');
});

// --- the with(it) fast path ---

function usesWith(tpl) {
  return /with\(it\)/.test(jst.compile(tpl, true));
}


test('bare identifiers still get with(it)', function() {
  assert.equal(usesWith('{{ title }}'), true);
  assert.equal(usesWith('{% if (user) { %}x{% } %}'), true);
});






// --- browser bundle ---


