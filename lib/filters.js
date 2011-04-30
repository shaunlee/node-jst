// filters

const htmlCodes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'},
      htmlre = /[&<>"]/g,
      htmlEscape = function (src) { return htmlCodes[src]; },
      linere = /(\r\n|\r|\n)/g,
      filterCodes = {
        'e(': 'jst_filter_escape(',
        'br(': 'jst_filter_linebreaks(',
        'md(': 'jst_filter_markdown(',
        '_(': 'jst_filter_gettext('
      },
      filterre = /^(e|br|md|_)\(/g,
      filterConvert = function(src) { return filterCodes[src]; };

exports.convert = function(src) {
  return src.replace(filterre, filterConvert);
}

// e(src)
jst_filter_escape = function(src) {
  return typeof src !== 'string' ? src : src.replace(htmlre, htmlEscape);
}

// br(src)
jst_filter_linebreaks = function(src) {
  return src.replace(linere, '<br>$1');
}

// md(src)
jst_filter_markdown = function(src) {
  return src; // TODO:
}

// _(src)
jst_filter_gettext = function(src) {
  return src; // TODO:
}

