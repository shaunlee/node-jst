/**
 * Node-jst for browsers
 * Copyright(c) 2011 Shaun Li <shonhen@gmail.com>
 * MIT Licensed
 */

// compiler

var jst = {};

;(function(exports) {

  var htmlCodes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'},
      htmlre = /&(?!\w+;)|<|>|"/g,
      htmlEscape = function (src) { return htmlCodes[src]; },
      linere = /(\r\n|\r|\n)/g,
      //
      _cache = {},
      _options = {
        useIt: false
      };

  var filters = exports.filters = {};

  (function(exports) {

    exports.convert = function(src) {
      return src.split('|').reduce(function(varname, filter) {
        return 'filters.' + filter + '(' + varname + ')';
      });
    }

    exports.e = exports.escape = function(src) {
      return typeof src !== 'string' ? src : src.replace(htmlre, htmlEscape);
    }

    exports.linebreaks = function(src) {
      return '<p>' + src.split(/\r\n|\n/g).join('</p><p>') + '</p>';
    }

    exports.linebreaksbr = function(src) {
      return src.replace(linere, '<br>$1');
    }

    exports.add = function(value) {
      return function(src) { return Number(value) + Number(src); };
    }

  })(exports.filters);

  exports.addFilter = function(name, fn) {
    filters[name] = fn;
  }

  exports.addFilters = function(newFilters) {
    for (var name in newFilters)
      filters[name] = newFilters[name];
  }

  var prefixes = {
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

    ctx = ctx.replace(/[\t\r\n]/g, ' ').replace(/\{#.+?#\}/g, ' ')

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
      return fn.call(this, args, filters);
    }
  }

  var render = exports.render = function(ctx, args) {
    var fn;
    if (typeof crc32 === 'function') {
      var ck = crc32(ctx);
      fn = _cache[ck];
      if (typeof fn === 'undefined')
        fn = _cache[ck] = compile(ctx);
    } else
      fn = compile(ctx);
    return fn(args);
  }

})(jst);

