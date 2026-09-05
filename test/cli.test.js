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

// Everything the CLI writes when it exits non-zero.
function runFail(args) {
  try {
    run(args);
  } catch (e) {
    return {status: e.status, stderr: e.stderr};
  }
  assert.fail('expected a non-zero exit');
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

test('the CLI prints usage', function() {
  var out = run(['--help']);

  assert.match(out, /^Usage: jst \[options\] <file\.\.\.>/);
  assert.match(out, /--version/);
});

test('the CLI rejects an unknown option', function() {
  var r = runFail(['--nope']);

  assert.equal(r.status, 1);
  assert.match(r.stderr, /unknown option '--nope'/);
  assert.match(r.stderr, /Usage: jst/, 'and shows how to use it');
});

test('the CLI reports a missing file without a stack trace', function() {
  var r = runFail([path.join(tmp, 'absent.jst')]);

  assert.equal(r.status, 1);
  assert.match(r.stderr, /no such file/);
  assert.doesNotMatch(r.stderr, /at Object\./, 'no stack trace');
});

test('the CLI reports a broken template with its position', function() {
  var p = tmpfile('broken.jst', 'x\n{% if ( %}\n{% } %}'),
      r = runFail([p]);

  assert.equal(r.status, 1);
  assert.match(r.stderr, /unbalanced "\("/);
  assert.match(r.stderr, /broken\.jst:2:1/, 'names the file and line');
  assert.doesNotMatch(r.stderr, /at Object\./, 'no stack trace');
});
