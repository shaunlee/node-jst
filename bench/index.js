#!/usr/bin/env node

/**
 * npm run bench [suite ...]
 *
 * Suites: engines, with, versions. All of them by default.
 * Runs under node and bun; the numbers in the Readme come from both.
 *
 * Two things will quietly ruin a template benchmark:
 *
 *   - With a constant context, JavaScriptCore hoists the whole render out of
 *     the timing loop. One template here reported 1.9 billion ops/s before the
 *     context was made to change every iteration.
 *   - `out += ...` builds a cons-string, and nothing is copied until something
 *     reads it. A result that is thrown away measures allocation, not
 *     rendering. Every result is read.
 */

var jst = require('..');

function optional(name) {
  try { return require(name); } catch (e) { return null; }
}

var doT = optional('dot'),
    ejs = optional('ejs'),
    hbs = optional('handlebars'),
    // npm:jst@0.0.13, the last published release before this work.
    old = optional('jst-baseline');

var runtime = typeof Bun !== 'undefined' ? 'bun ' + Bun.version
            : 'node ' + process.versions.node;

const WARMUP = 2000, ITERATIONS = 20000, ROUNDS = 7;

var sink = 0;

function bench(fn, data) {
  for (var i = 0; i < WARMUP; i++) { data.title = i; read(fn(data)); }

  var best = 0;
  for (var r = 0; r < ROUNDS; r++) {
    var started = process.hrtime.bigint();

    for (var i = 0; i < ITERATIONS; i++) { data.title = i; read(fn(data)); }

    var ops = ITERATIONS / (Number(process.hrtime.bigint() - started) / 1e9);
    if (ops > best) best = ops;
  }

  return best;
}

function read(out) { sink += out.charCodeAt(out.length - 1); }

// --- the page every suite renders ---

var body = new Array(60).join('<p class=row>a fairly long chunk of static markup</p>');

var templates = {
  jst:        '<title>{{ it.title }}</title>' + body
                + '{% for (var i = 0; i < it.rows.length; i++) { %}<li>{{ it.rows[i]|e }}</li>{% } %}',
  bare:       '<title>{{ title }}</title>' + body
                + '{% for (var i = 0; i < rows.length; i++) { %}<li>{{ rows[i]|e }}</li>{% } %}',
  codeOnly:   '<title>t</title>' + body + '{% if (it.title) { %}<h1>x</h1>{% } %}'
                + '{% for (var i = 0; i < it.rows.length; i++) { %}<li>y</li>{% } %}',
  doT:        '<title>{{=it.title}}</title>' + body
                + '{{ for (var i = 0; i < it.rows.length; i++) { }}<li>{{!it.rows[i]}}</li>{{ } }}',
  hbs:        '<title>{{title}}</title>' + body + '{{#each rows}}<li>{{this}}</li>{{/each}}',
  ejs:        '<title><%= title %></title>' + body
                + '<% for (var i = 0; i < rows.length; i++) { %><li><%= rows[i] %></li><% } %>'
};

function rows(markup) {
  var data = {title: 'x', rows: []};

  for (var i = 0; i < 20; i++) data.rows.push(markup(i));

  return data;
}

var everyRow = rows(function(i) { return 'row <' + i + '> & more'; }),
    oneInTen = rows(function(i) { return i % 10 ? 'an ordinary row label ' + i : 'a <b>tag</b>'; });

// --- reporting ---

function table(title, note, rows) {
  console.log('\n  ' + title);
  if (note) console.log('  ' + note);
  console.log('');

  var base = rows[0][1];

  rows.forEach(function(row) {
    console.log('    ' + row[0].padEnd(20)
      + (row[1] / 1000).toFixed(0).padStart(7) + 'k ops/s   '
      + (row[1] / base).toFixed(2) + 'x');
  });
}

function skip(name, why) {
  console.log('\n  ' + name + '\n  skipped: ' + why);
}

// --- suites ---

var suites = {};

suites.engines = function() {
  if (!doT || !ejs || !hbs)
    return skip('engines', 'run npm install for doT, ejs and handlebars');

  var compiled = [
    ['jst', jst.compile(templates.jst)],
    ['doT', doT.template(templates.doT)],
    ['handlebars', hbs.compile(templates.hbs)],
    ['ejs', ejs.compile(templates.ejs)]
  ];

  [['one row in ten contains markup', oneInTen],
   ['every row contains markup', everyRow]].forEach(function(shape) {
    table('5KB page, 20 escaped rows -- ' + shape[0], '',
      compiled.map(function(e) { return [e[0], bench(e[1], shape[1])]; }));
  });
}

suites.with = function() {
  table('what the it. prefix is worth',
    'the same page, reaching its variables two different ways',
    [['it. everywhere', bench(jst.compile(templates.jst), oneInTen)],
     ['bare identifiers', bench(jst.compile(templates.bare), oneInTen)]]);
}

suites.versions = function() {
  if (!old) return skip('versions', 'run npm install for the jst-baseline alias');

  var shapes = [
    ['it. in tags', templates.jst],
    ['it. only in {% %}', templates.codeOnly],
    ['bare identifiers', templates.bare]
  ];

  console.log('\n  against jst ' + old.version + ', the last published release');
  console.log('  compiled once and called, so this is code generation alone\n');

  shapes.forEach(function(s) {
    var a = bench(old.compile(s[1]), oneInTen),
        b = bench(jst.compile(s[1]), oneInTen);

    console.log('    ' + s[0].padEnd(20)
      + (a / 1000).toFixed(0).padStart(7) + 'k -> '
      + (b / 1000).toFixed(0).padStart(7) + 'k ops/s   ' + (b / a).toFixed(2) + 'x');
  });

  console.log('\n  through render(), which is what an app calls\n');

  shapes.forEach(function(s) {
    var a = bench(function(d) { return old.render(s[1], d); }, oneInTen),
        b = bench(function(d) { return jst.render(s[1], d); }, oneInTen);

    console.log('    ' + s[0].padEnd(20)
      + (a / 1000).toFixed(0).padStart(7) + 'k -> '
      + (b / 1000).toFixed(0).padStart(7) + 'k ops/s   ' + (b / a).toFixed(2) + 'x');
  });
}

// --- run ---

var wanted = process.argv.slice(2).filter(function(a) { return a in suites; });
if (!wanted.length) wanted = Object.keys(suites);

console.log('\n  ' + runtime + ', best of ' + ROUNDS + ' rounds of '
  + ITERATIONS.toLocaleString('en-US') + '\n  ' + '-'.repeat(46));

wanted.forEach(function(name) { suites[name](); });

console.log('');
if (sink === -1) console.log('unreachable');
