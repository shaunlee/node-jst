// filters

const htmlCodes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'},
      htmlre = /&(?!\w+;)|<|>|"|'/g,
      htmlEscape = function (src) { return htmlCodes[src]; },
      // Most strings need no escaping at all; one cheap scan beats building a
      // replacement for them.
      htmltestre = /[&<>"']/,
      linere = /(\r\n|\r|\n)/g;

exports.convert = function(src) {
  return src.split('|').reduce(function(varname, filter) {
    return 'filters.' + filter + '(' + varname + ')';
  });
}

function escape(src) {
  if (typeof src !== 'string' || !htmltestre.test(src)) return src;
  return src.replace(htmlre, htmlEscape);
}

function linebreaks(src) {
  return '<p>' + src.split(/\r\n|\n/g).join('</p><p>') + '</p>';
}

function linebreaksbr(src) {
  return src.replace(linere, '<br>$1');
}

function add(value) {
  return function(src) { return Number(value) + Number(src); };
}

function markdown(src) {
  return src; // TODO:
}

exports.filters = {
  escape: escape, e: escape,
  linebreaks: linebreaks,
  linebreaksbr: linebreaksbr,
  markdown: markdown, md: markdown,
  add: add
};

