/**
 * Node-jst
 * Copyright(c) 2011 Shaun Li <shonhen@gmail.com>
 * MIT Licensed
 */

var fs = require('fs'),
    filters = require('./filters'),
    hash = require('./hash');

exports.version = '0.0.13';

var _cache = {},
    _files = {},
    _options = {
      useIt: false
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
      codere = /\{[%\{] (.+?) [%\}]\}/g;

var compile = exports.compile = function(ctx) {
  var m, i = 0, code = 'var out = ', last = 'n';

  _options.useIt = /{{ (e\()?it\./.test(ctx);

  ctx = ctx.replace(/[\t\r\n]/g, '').replace(/\{#.+?#\}/g, '')

  if (!_options.useIt) {
    code += '""; with(it) {';
    last = 'c';
  }

  while ((m = codere.exec(ctx)) !== null) {
    if (m.index > 0 && m.index > i) {
      code += prefixes[last]['s'] + ctx.substring(i, m.index).replace(/"/g, '\\"');
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
    code += prefixes[last]['s'] + ctx.substring(i).replace(/"/g, '\\"');
    last = 's';
  }

  code += prefixes['end'][last];

  if (!_options.useIt)
    code += '} ';

  code += 'return out;';
  //console.log(code);

  var fn = new Function('it, filters', code);

  return function(args) {
    return fn.call(this, args, filters.filters);
  }
}

var render = exports.render = function(ctx, args) {
  var ck = hash.md5sum(ctx),
      fn = _cache[ck];

  if (typeof fn === 'undefined') {
    fn = _cache[ck] = compile(ctx);
  }

  return fn(args);
}

var renderFile = exports.renderFile = function(filename, args, fn) {
  if (typeof args === 'function') {
    fn = args;
    args = {};
  }

  var fk = hash.md5sum(filename);

  fs.stat(filename, function(err, stats) {
    if (err)
      return fn(err);

    _files[fk] = _files[fk] || {};

    if (isempty(_files[fk]) || _files[fk].ctime < stats.ctime) {
      fs.readFile(filename, 'utf8', function(err, ctx) {
        if (err)
          return fn(err);

        _files[fk].ctime = stats.ctime;
        _files[fk].ctx = ctx;

        try {
          fn(null, render(ctx, args));
        } catch(e) { fn(e); }
      });
    } else {
      try {
        fn(null, render(_files[fk].ctx, args));
      } catch(e) { fn(e); }
    }
  });
}

function isempty(o) {
  for (var prop in o)
    if (o.hasOwnProperty(prop))
      return false;
  return true;
}

