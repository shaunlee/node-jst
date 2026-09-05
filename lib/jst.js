/**
 * Node-jst
 * Copyright(c) 2011 Shaun Li <shonhen@gmail.com>
 * MIT Licensed
 */

var fs = require('fs'),
    filters = require('./filters');

exports.version = require('../package.json').version;

var _cache = Object.create(null),
    _files = Object.create(null),
    _options = {
      cache: false
    };

exports.configure = function(options) {
  for (var prop in options) {
    _options[prop] = options[prop];
  }
}

exports.addFilter = function(name, fn) {
  filters.filters[name] = fn;
}

exports.addFilters = function(newFilters) {
  for (var name in newFilters)
    filters.filters[name] = newFilters[name];
}

// compiler

const prefixes = {
        n: {s: '"', c: '', v: ''},
        s: {s: '', c: '"; ', v: '" + '},
        c: {s: ' out += "', c: ' ', v: ' out += '},
        v: {s: ' + "', c: '; ', v: ' + '},
        end: {s: '"; ', c: ' ', v: '; '}
      },
      codere = /\{[%\{] (.+?) [%\}]\}/g,
      // Both must be escaped; a lone `\` in the template would otherwise
      // start an escape sequence in the generated string literal.
      textre = /[\\"]/g;

var compile = exports.compile = function(ctx, isToCode) {
  var m, i = 0, code = 'var out = ', last = 'n',
      useIt = /{{ (e\()?it\./.test(ctx);

  ctx = ctx.replace(/[\t\r\n]/g, '').replace(/\{#.+?#\}/g, '')

  if (!useIt) {
    code += '""; with(it) {';
    last = 'c';
  }

  codere.lastIndex = 0;

  while ((m = codere.exec(ctx)) !== null) {
    if (m.index > 0 && m.index > i) {
      code += prefixes[last]['s'] + ctx.substring(i, m.index).replace(textre, '\\$&');
      last = 's';
    }

    if (m[0].indexOf('{%') === 0) {
      code += prefixes[last]['c'] + m[1];
      if (/\)$/.test(m[1])) code += ';';
      last = 'c';
    } else if (m[0].indexOf('{{') === 0) {
      code += prefixes[last]['v'] + filters.convert(m[1]);
      last = 'v';
    }

    i = m.index + m[0].length;
  }

  if (i < ctx.length) {
    code += prefixes[last]['s'] + ctx.substring(i).replace(textre, '\\$&');
    last = 's';
  }

  code += prefixes['end'][last];

  if (!useIt)
    code += '} ';

  code += 'return out;';

  if(isToCode) {
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

var renderFile = exports.renderFile = function(filename, args, fn) {
  if (typeof args === 'function') {
    fn = args;
    args = {};
  }

  var cached = _files[filename];

  function finish(compiled) {
    var res;
    try {
      res = compiled(args);
    } catch(e) {
      return fn(e);
    }
    fn(null, res);
  }

  // With caching on, skip the stat() entirely; nextTick keeps the callback
  // asynchronous either way.
  if (cached && _options.cache)
    return process.nextTick(function() { finish(cached.fn); });

  fs.stat(filename, function(err, stats) {
    if (err)
      return fn(err);

    if (cached && cached.mtime >= stats.mtimeMs)
      return finish(cached.fn);

    fs.readFile(filename, 'utf8', function(err, ctx) {
      if (err)
        return fn(err);

      var compiled;
      try {
        compiled = compile(ctx);
      } catch(e) {
        return fn(e);
      }

      _files[filename] = {mtime: stats.mtimeMs, fn: compiled};

      finish(compiled);
    });
  });
}
