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

exports.configure = compiler.configure;
exports.cacheSize = compiler.cacheSize;

var _files = Object.create(null),
    _options = compiler.options;

/**
 * The synchronous twin of renderFile, sharing its cache. Composing views --
 * a layout around a body, a partial inside a layout -- has to happen inside a
 * template, where there is nowhere to put a callback.
 */
var renderFileSync = exports.renderFileSync = function(filename, args) {
  var cached = _files[filename];

  if (!(cached && _options.cache)) {
    var stats = fs.statSync(filename);

    if (!cached || cached.mtime < stats.mtimeMs) {
      cached = _files[filename] = {
        mtime: stats.mtimeMs,
        fn: compiler.compile(fs.readFileSync(filename, 'utf8'), false, filename)
      };
    }
  }

  return cached.fn(args);
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
        compiled = compiler.compile(ctx, false, filename);
      } catch(e) {
        return fn(e);
      }

      _files[filename] = {mtime: stats.mtimeMs, fn: compiled};

      finish(compiled);
    });
  });
}
