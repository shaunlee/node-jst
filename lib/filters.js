// filters

const htmlCodes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'},
      htmlre = /[&<>"]/g,
      htmlEscape = function (src) { return htmlCodes[src]; };

// e(src)
jst_filter_escape = function(src) {
  return typeof src !== 'string' ? src : src.replace(htmlre, htmlEscape);
}

