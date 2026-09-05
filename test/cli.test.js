var test = require('node:test'),
    assert = require('node:assert'),
    fs = require('fs'),
    os = require('os'),
    path = require('path'),
    { execFileSync } = require('child_process'),
    jst = require('../index');

var bin = path.join(__dirname, '..', 'bin', 'jst'),
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-cli-'));

function run(args) {
  return execFileSync(process.execPath, [bin].concat(args), {encoding: 'utf8'});
}

function tmpfile(name, ctx) {
  var p = path.join(tmp, name);
  fs.writeFileSync(p, ctx, 'utf8');
  return p;
}

test('the CLI reports the package version', function() {
  assert.equal(run(['--version']).trim(), jst.version);
});

test('the CLI compiles a template to runnable source', function() {
  var out = run([tmpfile('a.jst', 'Hello {{ it.name|e }}')]);

  // The emitted source expects a `jst` global carrying the filters.
  var fn = new Function('jst', 'return ' + out)({filters: jst.filters});

  assert.equal(typeof fn, 'function');
  assert.equal(fn({name: '<b>'}), 'Hello &lt;b&gt;');
});

test('the CLI compiles several templates at once', function() {
  var out = run([tmpfile('b.jst', 'one'), tmpfile('c.jst', 'two')]);

  assert.equal(out.trim().split('\n').length, 2);
});

test('the CLI reports missing arguments', function() {
  assert.throws(function() { run([]); }, /missing required argument/);
});
