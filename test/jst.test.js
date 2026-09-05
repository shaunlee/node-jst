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

test('renders plain text unchanged', function() {
  assert.equal(jst.render('Hello world'), 'Hello world');
});

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

test('runs embedded code blocks', function() {
  assert.equal(
    jst.render('{% for (var i = 0; i < 3; i++) { %}[{{ i }}]{% } %}'),
    '[0][1][2]');
});

test('code blocks can branch on data', function() {
  var t = '{% if (user) { %}<h2>{{ user.name }}</h2>{% } %}';
  assert.equal(jst.render(t, {user: {name: 'jst'}}), '<h2>jst</h2>');
  assert.equal(jst.render(t, {user: null}), '');
});

test('strips {# comments #}', function() {
  assert.equal(jst.render('a{# nope #}b'), 'ab');
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

test('literal backslashes survive', function() {
  assert.equal(jst.render('C:\\path\\to {{ a }}', {a: 1}), 'C:\\path\\to 1');
  assert.equal(jst.render('content:"\\f101"'), 'content:"\\f101"');
});

// --- filters ---

test('escape filter', function() {
  assert.equal(jst.render('{{ it.v|e }}', {v: '<b>&</b>'}), '&lt;b&gt;&amp;&lt;/b&gt;');
});

test('escape filter escapes single quotes', function() {
  assert.equal(jst.render("{{ it.v|e }}", {v: "it's"}), 'it&#39;s');
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

test('renderFile calls back exactly once when the template throws', function(t, done) {
  var p = tmpfile('e.jst', '{{ it.a.b.c }}'),
      calls = 0;
  jst.renderFile(p, {}, function(err) {
    calls++;
    assert.ok(err, 'should report the render error');
  });
  setTimeout(function() {
    assert.equal(calls, 1);
    done();
  }, 50);
});

test('version matches package.json', function() {
  assert.equal(jst.version, require('../package.json').version);
});

test('configure({cache:true}) skips the stat and serves the cached function', function(t, done) {
  var p = tmpfile('f.jst', 'v1');
  jst.renderFile(p, {}, function(err, first) {
    assert.ifError(err);
    assert.equal(first, 'v1');
    jst.configure({cache: true});
    tmpfile('f.jst', 'v2');
    jst.renderFile(p, {}, function(err, second) {
      jst.configure({cache: false});
      assert.ifError(err);
      assert.equal(second, 'v1', 'change ignored while cached');
      done();
    });
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

test('a // comment in a code block does not swallow the template', function() {
  assert.equal(jst.render('{% // a note %}kept {{ it.a }}', {a: 1}), 'kept 1');
});

test('multi-line code blocks work', function() {
  var t = '{%\n  var n = 2;\n  // double it\n  n = n * 2;\n%}{{ n }}';
  assert.equal(jst.render(t, {}), '4');
});

test('multi-line comments are stripped', function() {
  assert.equal(jst.render('a{#\n  gone\n#}b', {}), 'ab');
});

test('layout whitespace is collapsed', function() {
  assert.equal(jst.render('<p>\n  a\n</p>', {}), '<p>  a</p>');
});

test('<pre> content is preserved verbatim', function() {
  assert.equal(jst.render('<pre>\n  a\n\tb\n</pre>\n<p>c</p>', {}),
    '<pre>\n  a\n\tb\n</pre><p>c</p>');
});

test('<textarea> content is preserved verbatim', function() {
  assert.equal(jst.render('<textarea>\na\n</textarea>\n<p>b</p>', {}),
    '<textarea>\na\n</textarea><p>b</p>');
});

test('interpolation always yields a string', function() {
  assert.equal(typeof jst.render('{{ it.a }}', {a: 1}), 'string');
  assert.equal(jst.render('{{ it.a }}', {a: 1}), '1');
});

test('an empty template renders an empty string', function() {
  assert.equal(jst.render('', {}), '');
  assert.equal(jst.render('{% var i = 0 %}', {}), '');
});

// --- the with(it) fast path ---

function usesWith(tpl) {
  return /with\(it\)/.test(jst.compile(tpl, true));
}

test('it.-only templates skip with(it), even inside code blocks', function() {
  assert.equal(usesWith('{{ it.a }}'), false);
  assert.equal(usesWith('{% if (it.a) { %}x{% } %}'), false);
  assert.equal(usesWith('{{ f(it.a) }}'), true, 'f comes from the context');
  assert.equal(usesWith('{{ it.f(it.a) }}'), false);
  assert.equal(usesWith('{% for (var i = 0; i < it.n; i++) { %}{{ i }}{% } %}'), false);
  assert.equal(usesWith('{{ it.a|e }}'), false);
  assert.equal(usesWith('{{ it.a|add(1) }}'), false);
});

test('bare identifiers still get with(it)', function() {
  assert.equal(usesWith('{{ title }}'), true);
  assert.equal(usesWith('{% if (user) { %}x{% } %}'), true);
});

test('the fast path renders the same output as with(it)', function() {
  var fast = '{% for (var i = 0; i < it.rows.length; i++) { %}<li>{{ it.rows[i]|e }}</li>{% } %}',
      slow = '{% for (var i = 0; i < rows.length; i++) { %}<li>{{ rows[i]|e }}</li>{% } %}',
      data = {rows: ['a<b>', 'c&d']};
  assert.equal(usesWith(fast), false);
  assert.equal(usesWith(slow), true);
  assert.equal(jst.render(fast, data), jst.render(slow, data));
});

test('scope analysis is conservative around ambiguity', function() {
  var scope = require('../lib/scope');
  assert.equal(scope.needsWith('it.a'), false);
  assert.equal(scope.needsWith('"a bareword in a string"'), false);
  assert.equal(scope.needsWith('// a bareword in a comment'), false);
  assert.equal(scope.needsWith('it.f({key: it.v})'), false, 'object keys are not variables');
  assert.equal(scope.needsWith('it.a ? it.b : c'), true, 'ternary branches are');
  assert.equal(scope.needsWith('try { it.a() } catch (e) { e.message }'), false);
  assert.equal(scope.needsWith('it.l.map(function (row) { return row.x })'), false);
  assert.equal(scope.needsWith('helper(it.a)'), true);
});

test('an it.-style template may start with a code block', function() {
  assert.equal(
    jst.render('{% if (it.user) { %}<h2>{{ it.user.name }}</h2>{% } %}', {user: {name: 'u'}}),
    '<h2>u</h2>');
  assert.equal(
    jst.render('{% for (var i = 0; i < it.n; i++) { %}x{% } %}', {n: 3}), 'xxx');
});

test('a template-declared variable is usable without it.', function() {
  assert.equal(jst.render('{% var x = 1 %}{{ x }}', {}), '1');
  assert.equal(jst.render('{% var x = 1 %}{{ it.a }}{{ x }}', {a: 'A'}), 'A1');
});

test('both variable styles may be mixed in one template', function() {
  assert.equal(jst.render('{{ title }}|{{ it.title }}', {title: 'T'}), 'T|T');
});

// --- browser bundle ---

test('jst.js is a current build of lib/', function() {
  var bundle = require('../bin/build-browser');
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'jst.js'), 'utf8'), bundle(),
    'jst.js is stale; run `npm run build`');
});

test('the browser bundle behaves like the node build', function() {
  var browser = require('../jst.js'),
      cases = [
        ['Hello {{ it.name }}', {name: 'b'}],
        ['Hello {{ name }}', {name: 'b'}],
        ['{% for (var i = 0; i < it.n; i++) { %}<li>{{ it.rows[i]|e }}</li>{% } %}',
         {n: 2, rows: ['a<b>', 'c&d']}],
        ['C:\\path {{ it.a }}', {a: 1}],
        ['<pre>\n x\n</pre>\n<p>y</p>', {}],
        ['{% // note %}kept', {}]
      ];

  cases.forEach(function(c) {
    assert.equal(browser.render(c[0], c[1]), jst.render(c[0], c[1]), c[0]);
  });
});

// --- expressions ---

test('low-precedence operators survive concatenation', function() {
  assert.equal(jst.render('{{ it.a || it.b }}', {a: 0, b: 'fallback'}), 'fallback');
  assert.equal(jst.render('pre{{ it.a ? "x" : "y" }}post', {a: 1}), 'prexpost');
  assert.equal(jst.render('pre{{ it.a ? "x" : "y" }}post', {a: 0}), 'preypost');
  assert.equal(jst.render('{{ it.a && it.b }}', {a: 1, b: 'both'}), 'both');
});

test('a | inside an expression is not a filter separator', function() {
  assert.equal(jst.render('{{ it.f("a|b") }}', {f: function(s) { return s; }}), 'a|b');
  assert.equal(jst.render('{{ (it.a | 0) + 1 }}', {a: 4.7}), '5');
});

test('filters still chain and take arguments', function() {
  assert.equal(jst.render('{{ it.v|add(1)|add(1) }}', {v: 1}), '3');
  assert.equal(jst.render('{{ it.a || it.b|e }}', {a: null, b: '<x>'}), '&lt;x&gt;');
});

test('a malformed filter is reported, not emitted as broken code', function() {
  assert.throws(function() { jst.render('{{ it.a|1 }}', {}); },
    /is not a filter name/);
});

// --- strict tag syntax ---

test('{{a}} is rejected instead of reaching the page', function() {
  assert.throws(function() { jst.render('<p>{{a}}</p>', {a: 1}); },
    /unexpected `\{\{`/);
  assert.throws(function() { jst.render('{%if (1) {%}x{% } %}', {}); },
    /unexpected `\{%`/);
});

test('a literal {{ can still be written', function() {
  assert.equal(jst.render('{{ "{{" }}name{{ "}}" }}', {}), '{{name}}');
});

test('the error points at the line and column', function() {
  try {
    jst.compile('<p>ok</p>\n<div>\n  {{name}}\n</div>', false, 'views/index.jst');
    assert.fail('should have thrown');
  } catch (e) {
    assert.equal(e.fileName, 'views/index.jst');
    assert.equal(e.line, 3);
    assert.equal(e.column, 3);
    assert.match(e.message, /views\/index\.jst:3:3/);
    assert.match(e.message, /\{\{name\}\}/, 'shows the offending line');
    assert.match(e.message, /\^/, 'and points at it');
  }
});

test('a broken tag is blamed rather than the generated code', function() {
  try {
    jst.compile('<p>ok</p>\n{% if ( %}\n{% } %}', false, 'page.jst');
    assert.fail('should have thrown');
  } catch (e) {
    assert.match(e.message, /unbalanced "\("/);
    assert.equal(e.line, 2);
  }
});

test('an unlocatable failure still shows what was generated', function() {
  try {
    jst.compile('{% var 1x = 2 %}', false, 'page.jst');
    assert.fail('should have thrown');
  } catch (e) {
    assert.match(e.message, /could not compile page\.jst/);
    assert.match(e.message, /Generated code:/);
    assert.ok(e.cause, 'keeps the underlying error');
  }
});

test('compiling to source is checked too', function() {
  assert.throws(function() { jst.compile('{% var 1x = 2 %}', true, 'page.jst'); },
    /could not compile/);
});

// --- filters are null-safe ---

test('filters pass non-strings through instead of throwing', function() {
  var filters = require('../lib/filters').filters;

  [null, undefined, 0, 42].forEach(function(v) {
    assert.equal(filters.escape(v), v);
    assert.equal(filters.linebreaks(v), v);
    assert.equal(filters.linebreaksbr(v), v);
  });
});

test('linebreaks and linebreaksbr agree on what a line break is', function() {
  var filters = require('../lib/filters').filters;

  assert.equal(filters.linebreaks('a\r\nb\rc\nd'), '<p>a</p><p>b</p><p>c</p><p>d</p>');
  assert.equal(filters.linebreaksbr('a\rb'), 'a<br>\rb');
});

test('there is no filter that silently does nothing', function() {
  var filters = require('../lib/filters').filters;

  assert.equal(filters.markdown, undefined);
  assert.equal(filters.md, undefined);
});

// --- the compiled-function cache is bounded ---


