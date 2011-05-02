// i18n

exports.locale = '';

/**
 * gettext('Hello {name}', {name: 'jst'})
 */
exports.gettext = function(ctx, args) {
  // TODO:

  for (var name in args) {
    var re = RegExp('\\{' + name + '\\}', 'g');
    ctx = ctx.replace(re, args[name]);
  }
  return ctx;
}

/**
 * ngettext('There is a template', 'There are {n} templates', n)
 */
exports.ngettext = function(singular, plural, n) {
  var ctx = n === 1 ? singular : plural;

  // TODO:

  return ctx.replace(/\{n\}/g, n);
}

