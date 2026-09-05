/**
 * Node-jst
 * Copyright(c) 2011 Shaun Li <me@shaunli.com>
 * MIT Licensed
 */

var fs = require('fs'),
    compiler = require('./compiler');

exports.version = require('../package.json').version;

exports.compile = compiler.compile;
exports.render = compiler.render;
exports.filters = compiler.filters;
exports.addFilter = compiler.addFilter;
exports.addFilters = compiler.addFilters;

var _files = Object.create(null),
    _options = {
      cache: false
    };

exports.configure = function(options) {
  for (var prop in options) {
    _options[prop] = options[prop];
  }
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
        compiled = compiler.compile(ctx);
      } catch(e) {
        return fn(e);
      }

      _files[filename] = {mtime: stats.mtimeMs, fn: compiled};

      finish(compiled);
    });
  });
}
