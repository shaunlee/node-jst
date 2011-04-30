/**
 * Node-jst
 * Copyright(c) 2011 Shaun Li <shonhen@gmail.com>
 * MIT Licensed
 */

var fs = require('fs'),
    crypto = require('crypto'),
    filters = require('./filters');

exports.version = '0.0.5';

var _cache = {},
    _files = {},
    _options = {
      useIt: false
    };

function md5sum(ctx) {
  return crypto.createHash('md5').update(ctx).digest('hex');
}

exports.configure = function(options) {
  for (var prop in options)
    _options[prop] = options[prop];
}

// compiler

const prefixes = {
        s: {s: '', c: '"; ', v: '" + '},
        c: {s: ' out += "', c: ' ', v: ' out += '},
        v: {s: ' + "', c: '; ', v: ' + '},
        end: {s: '"; ', c: ' ', v: '; '}
      },
      codere = /\{[%\{] (.+?) [%\}]\}/g;

var compile = exports.compile = function(ctx) {
  var m, s, i = 0, code = 'var out = "', last = 's';

  _options.useIt = /{{ (e\()?it\./.test(ctx);

  ctx = ctx.replace(/[\t\r\n]/g, '').replace(/\{#.+?#\}/g, '')

  if (!_options.useIt) {
    code += '"; with(it) {';
    last = 'c';
  }

  while ((m = codere.exec(ctx)) !== null) {
    if (m.index > 0) {
      code += prefixes[last]['s'] + ctx.substring(i, m.index).replace(/"/g, '\\"');
      last = 's';
    }

    if (m[0].indexOf('{%') === 0) {
      code += prefixes[last]['c'] + m[1];
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

  return new Function('it', code);
}

var render = exports.render = function(ctx, args) {
  var ck = md5sum(ctx),
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

  var fk = md5sum(filename);

  fs.stat(filename, function(err, stats) {
    if (err)
      return fn(err);

    _files[fk] = _files[fk] || {};

    if (_files[fk].isEmpty() || _files[fk].ctime < stats.ctime) {
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

if (typeof Object.prototype.isEmpty === 'undefined') {
  Object.prototype.isEmpty = function() {
    for (var prop in this)
      if (this.hasOwnProperty(prop))
        return false;
    return true;
  }
}

