// filters

const htmlCodes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'},
      htmlre = /&(?!\w+;)|<|>|"/g,
      htmlEscape = function (src) { return htmlCodes[src]; },
      linere = /(\r\n|\r|\n)/g;

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

exports.md = exports.markdown = function(src) {
  return src; // TODO:
}

exports.add = function(value) {
  return function(src) { return Number(value) + Number(src); };
}

