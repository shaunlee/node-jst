/**
 * Node-jst
 * Copyright(c) 2011 Shaun Li <shonhen@gmail.com>
 * MIT Licensed
 */

var fs = require('fs'),
    crypto = require('crypto');

exports.version = '0.0.1';

var _cache = {},
    _files = {};

function md5sum(ctx) {
  return crypto.createHash('md5').update(ctx).digest('hex');
}

var compile = exports.compile = function(ctx) {
  var ck = md5sum(ctx);

  if (typeof _cache[ck] === 'undefined') {
    var code = 'var out = ""; with(args) { out += "'
      + ctx.replace(/[\t\r\n]/g, '')
          .replace(/"/g, '\\"').replace(/\{#.+?#\}/g, '')
          .replace(/\{\{ (.*?) \}\}/g, '"; out += $1; out +="')
          .split('\{% ').join('"; ')
          .split(' %\}').join(' out +="')
      + '"; } return out;';
    _cache[ck] = new Function('args', code);
  }

  return function(args) {
    return _cache[ck](args);
  };
}

var render = exports.render = function(ctx, args) {
  return compile(ctx)(args);
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
          fn(null, compile(ctx)(args));
        } catch(e) { fn(e); }
      });
    } else {
      try {
        fn(null, compile(_files[fk].ctx)(args));
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

