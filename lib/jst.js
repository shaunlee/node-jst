/**
 * Node-jst
 * Copyright(c) 2011 Shaun Li <shonhen@gmail.com>
 * MIT Licensed
 */

var fs = require('fs'),
    crypto = require('crypto');

exports.version = '0.0.2';

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

var compile = exports.compile = function(ctx) {
  _options.useIt = ctx.indexOf('{{ it.') > -1;

  var code = (_options.useIt ? 'var out = "' : 'var out = ""; with(it) { out += "')
    + ctx.replace(/[\t\r\n]/g, '')
        .replace(/"/g, '\\"').replace(/\{#.+?#\}/g, '')
        .replace(/\{\{ (.*?) \}\}/g, '"; out += $1; out +="')
        .split('\{% ').join('"; ')
        .split(' %\}').join(' out +="')
    + (_options.useIt ? '"; return out;' : '"; } return out;');
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

