// filters

const htmlCodes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'},
      htmlre = /&(?!\w+;)|<|>|"|'/g,
      htmlEscape = function (src) { return htmlCodes[src]; },
      // Most strings need no escaping at all; one cheap scan beats building a
      // replacement for them.
      htmltestre = /[&<>"']/,
      linere = /(\r\n|\r|\n)/g,
      breakre = /\r\n|\r|\n/g,
      // A filter is a name, optionally called with arguments.
      filterre = /^[A-Za-z_$][\w$]*(?:\([\s\S]*\))?$/;

/**
 * Splits `expr|filter|filter(arg)` on the filter separator. A `|` inside a
 * string or a nested call belongs to the expression, and `||` is the logical
 * operator rather than two empty filters.
 */
exports.split = function(src) {
  var parts = [], start = 0, depth = 0, quote = null;

  for (var i = 0; i < src.length; i++) {
    var ch = src[i];

    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === '|' && depth === 0) {
      if (src[i + 1] === '|') { i++; continue; }

      parts.push(src.substring(start, i));
      start = i + 1;
    }
  }

  parts.push(src.substring(start));

  return parts;
}

exports.convert = function(parts) {
  return parts.reduce(function(code, filter) {
    filter = filter.trim();

    if (!filterre.test(filter))
      throw new Error('`' + filter + '` is not a filter name');

    return 'filters.' + filter + '(' + code + ')';
  });
}

function escape(src) {
  if (typeof src !== 'string' || !htmltestre.test(src)) return src;
  return src.replace(htmlre, htmlEscape);
}

function linebreaks(src) {
  if (typeof src !== 'string') return src;
  return '<p>' + src.split(breakre).join('</p><p>') + '</p>';
}

function linebreaksbr(src) {
  if (typeof src !== 'string') return src;
  return src.replace(linere, '<br>$1');
}

function add(value) {
  return function(src) { return Number(value) + Number(src); };
}

exports.filters = {
  escape: escape, e: escape,
  linebreaks: linebreaks,
  linebreaksbr: linebreaksbr,
  add: add
};
