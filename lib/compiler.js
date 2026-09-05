/**
 * Node-jst compiler
 * Copyright(c) 2011 Shaun Li <me@shaunli.com>
 * MIT Licensed
 *
 * Platform-independent: no fs, no path. lib/jst.js adds file rendering on top
 * and bin/build-browser bundles this file for the browser.
 */

var filters = require('./filters'),
    scope = require('./scope');

exports.filters = filters.filters;

exports.addFilter = function(name, fn) {
  filters.filters[name] = fn;
}

exports.addFilters = function(newFilters) {
  for (var name in newFilters)
    filters.filters[name] = newFilters[name];
}

var _cache = Object.create(null);

// compiler

const prefixes = {
        n: {s: '"', c: '""; ', v: '"" + '},
        s: {s: '', c: '"; ', v: '" + '},
        c: {s: ' out += "', c: ' ', v: ' out += '},
        v: {s: ' + "', c: '; ', v: ' + '},
        end: {n: '""; ', s: '"; ', c: ' ', v: '; '}
      },
      tokenre = /\{#[\s\S]*?#\}|\{%\s([\s\S]+?)\s%\}|\{\{\s([\s\S]+?)\s\}\}/g,
      textcodes = {'\\': '\\\\', '"': '\\"', '\n': '\\n', '\r': '\\r', '\t': '\\t',
        '\u2028': '\\u2028', '\u2029': '\\u2029'},
      textre = /[\\"\n\r\t\u2028\u2029]/g,
      textEscape = function(src) { return textcodes[src]; },
      // <pre> and <textarea> content is significant and must survive minifying.
      rawre = /<(\/?)(?:pre|textarea)\b/gi,
      wsre = /[\t\r\n]/g;

// Collapses layout whitespace, but leaves anything inside <pre>/<textarea>
// alone. `state.raw` carries the nesting depth across text segments.
function minify(text, state) {
  var m, out = '', i = 0;

  rawre.lastIndex = 0;

  while ((m = rawre.exec(text)) !== null) {
    out += strip(text.substring(i, m.index), state) + m[0];
    if (m[1]) { if (state.raw > 0) state.raw--; } else state.raw++;
    i = m.index + m[0].length;
  }

  return out + strip(text.substring(i), state);
}

function strip(text, state) {
  return state.raw > 0 ? text : text.replace(wsre, '');
}

var compile = exports.compile = function(ctx, isToCode) {
  var m, i = 0,
      state = {raw: 0},
      // Segments are collected first because whether the code needs a
      // `with(it)` block decides how the very first one is emitted.
      segs = [],
      script = '';

  function text(src) {
    src = minify(src, state);
    if (src !== '') segs.push({s: src.replace(textre, textEscape)});
  }

  tokenre.lastIndex = 0;

  while ((m = tokenre.exec(ctx)) !== null) {
    if (m.index > i) text(ctx.substring(i, m.index));

    if (m[1] !== undefined) {
      // `{% code %}` — newlines around it keep a trailing `//` comment from
      // swallowing the statements the compiler appends.
      segs.push({c: '\n' + m[1] + (/\)$/.test(m[1]) ? ';' : '') + '\n'});
      script += m[1] + '\n';
    } else if (m[2] !== undefined) {
      segs.push({v: filters.convert(m[2])});
      script += scope.expression(m[2]) + '\n';
    }
    // `{# comment #}` falls through, emitting nothing.

    i = m.index + m[0].length;
  }

  if (i < ctx.length) text(ctx.substring(i));

  var useWith = scope.needsWith(script),
      last = useWith ? 'c' : 'n',
      body = '';

  for (i = 0; i < segs.length; i++) {
    var kind = segs[i].s !== undefined ? 's' : segs[i].c !== undefined ? 'c' : 'v';
    body += prefixes[last][kind] + segs[i][kind];
    last = kind;
  }

  body += prefixes['end'][last];

  var code = 'var out = ' + (useWith ? '""; with(it) {' + body + '} ' : body) + 'return out;';

  if (isToCode) {
    return 'function(it) { it = it || {}; var filters = jst.filters;' + code + '}';
  } else {
    // `filters` is closed over rather than passed in, so the returned function
    // takes a single argument and needs no call-time forwarding.
    return new Function('filters',
      'return function(it) { it = it || {};' + code + '}')(filters.filters);
  }
}

var render = exports.render = function(ctx, args) {
  var fn = _cache[ctx];

  if (fn === undefined) {
    fn = _cache[ctx] = compile(ctx);
  }

  return fn(args);
}

