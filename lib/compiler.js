/**
 * Node-jst compiler
 * Copyright(c) 2011 Shaun Li <me@shaunli.com>
 * MIT Licensed
 *
 * Platform-independent: no fs, no path. lib/jst.js adds file rendering on top
 * and bin/build-browser bundles this file for the browser.
 */

var filters = require('./filters'),
    scope = require('./scope'),
    errors = require('./errors');

exports.filters = filters.filters;

exports.addFilter = function(name, fn) {
  filters.filters[name] = fn;
}

exports.addFilters = function(newFilters) {
  for (var name in newFilters)
    filters.filters[name] = newFilters[name];
}

// render() is often handed strings built at runtime, so the compiled-function
// cache is bounded and evicts in insertion order rather than growing forever.
var _cache = new Map(),
    _options = exports.options = {
      cache: false,
      cacheLimit: 1000
    };

exports.configure = function(options) {
  for (var prop in options) {
    _options[prop] = options[prop];
  }

  evict();
}

// Number of compiled templates currently held.
exports.cacheSize = function() { return _cache.size; }

function evict() {
  while (_cache.size > _options.cacheLimit)
    _cache.delete(_cache.keys().next().value);
}

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
      wsre = /[\t\r\n]/g,
      // A `{{` or `{%` left in the text means a tag was written without the
      // spaces the syntax requires, and would otherwise reach the page as-is.
      strayre = /\{\{|\{%/;

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

var compile = exports.compile = function(ctx, isToCode, name) {
  var m, i = 0,
      state = {raw: 0},
      // Segments are collected first because whether the code needs a
      // `with(it)` block decides how the very first one is emitted.
      segs = [],
      // Tag sources, kept so a failed compile can say which tag broke it.
      tags = [],
      script = '';

  function text(src, offset) {
    var stray = strayre.exec(src);

    if (stray)
      throw errors.at('unexpected `' + stray[0] + '` -- a tag needs spaces '
        + 'inside it, as `{{ name }}` or `{% code %}`. For a literal, write '
        + '`{{ \'' + stray[0] + '\' }}`', ctx, offset + stray.index, name);

    src = minify(src, state);
    if (src !== '') segs.push({s: src.replace(textre, textEscape)});
  }

  tokenre.lastIndex = 0;

  while ((m = tokenre.exec(ctx)) !== null) {
    if (m.index > i) text(ctx.substring(i, m.index), i);

    if (m[1] !== undefined) {
      // `{% code %}` — newlines around it keep a trailing `//` comment from
      // swallowing the statements the compiler appends.
      segs.push({c: '\n' + m[1] + (/\)$/.test(m[1]) ? ';' : '') + '\n'});
      script += m[1] + '\n';
      tags.push({index: m.index, src: m[1], braces: false});
    } else if (m[2] !== undefined) {
      var parts = filters.split(m[2]);

      try {
        // Parenthesised: the value is concatenated into a larger expression,
        // and `||`, `?:` and friends bind looser than `+`.
        segs.push({v: '(' + filters.convert(parts) + ')'});
      } catch (e) {
        throw errors.at(e.message, ctx, m.index, name);
      }

      script += scope.expression(parts) + '\n';
      tags.push({index: m.index, src: m[2], braces: true});
    }
    // `{# comment #}` falls through, emitting nothing.

    i = m.index + m[0].length;
  }

  if (i < ctx.length) text(ctx.substring(i), i);

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

  // `filters` is closed over rather than passed in, so the compiled function
  // takes a single argument and needs no call-time forwarding.
  var source = isToCode
    ? 'function(it) { it = it || {}; var filters = jst.filters;' + code + '}'
    : 'return function(it) { it = it || {};' + code + '}';

  try {
    var fn = new Function('filters', isToCode ? 'return ' + source : source);
    return isToCode ? source : fn(filters.filters);
  } catch (e) {
    // The generated code did not parse. Point at the tag responsible if one
    // stands out, and fall back to showing what was generated.
    var blamed = errors.blame(tags);

    throw blamed
      ? errors.at(blamed.reason + ' in this tag', ctx, blamed.index, name)
      : errors.generated(e, source, name);
  }
}

var render = exports.render = function(ctx, args) {
  var fn = _cache.get(ctx);

  if (fn === undefined) {
    fn = compile(ctx);

    _cache.set(ctx, fn);
    evict();
  }

  return fn(args);
}

