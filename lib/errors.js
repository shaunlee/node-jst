/**
 * Compiler diagnostics.
 *
 * A template that will not compile used to report whatever V8 said about the
 * generated code -- "Unexpected token 'return'" -- with no hint of which
 * template, let alone which line, was at fault.
 */

function position(ctx, index) {
  var line = 1, start = 0;

  for (var i = 0; i < index; i++) {
    if (ctx.charCodeAt(i) === 10) { line++; start = i + 1; }
  }

  return {line: line, column: index - start + 1};
}

// Three lines of context with a caret under the offending column.
function excerpt(ctx, pos) {
  var lines = ctx.split('\n'),
      width = String(Math.min(lines.length, pos.line + 1)).length,
      out = [];

  for (var n = Math.max(1, pos.line - 2); n <= Math.min(lines.length, pos.line + 1); n++) {
    var num = String(n).padStart(width);

    out.push('  ' + num + ' | ' + lines[n - 1]);

    if (n === pos.line)
      out.push('  ' + ' '.repeat(width) + ' | ' + ' '.repeat(pos.column - 1) + '^');
  }

  return out.join('\n');
}

exports.at = function(message, ctx, index, name) {
  var pos = position(ctx, index),
      err = new Error('jst: ' + message + '\n  at ' + (name || '<template>')
        + ':' + pos.line + ':' + pos.column + '\n\n' + excerpt(ctx, pos) + '\n');

  err.fileName = name;
  err.line = pos.line;
  err.column = pos.column;

  return err;
}

// Last resort: the generated code did not parse and nothing in the template
// looked obviously wrong, so show what was generated.
exports.generated = function(cause, code, name) {
  var lines = code.split('\n'),
      shown = lines.slice(0, 40).map(function(line, i) {
        if (line.length > 120) line = line.substring(0, 117) + '...';
        return '  ' + String(i + 1).padStart(3) + ' | ' + line;
      });

  if (lines.length > 40) shown.push('      | ... ' + (lines.length - 40) + ' more lines');

  var err = new Error('jst: could not compile ' + (name || '<template>') + '\n  '
    + cause.message + '\n\nGenerated code:\n' + shown.join('\n') + '\n');

  err.fileName = name;
  err.cause = cause;

  return err;
}

/**
 * Points at the tag that most likely broke a compile. Only ever called once
 * the compile has already failed, so a false positive costs nothing and
 * regex literals, comments and division do not have to be told apart
 * perfectly.
 */
exports.blame = function(tags) {
  for (var i = 0; i < tags.length; i++) {
    var reason = unbalanced(tags[i].src, tags[i].braces);
    if (reason) return {index: tags[i].index, reason: reason};
  }
  return null;
}

// Braces legitimately span tags -- {% if (x) { %} opens one that {% } %}
// closes -- so they are only checked inside a {{ }} expression.
function unbalanced(src, braces) {
  var stack = [], quote = null,
      opens = {')': '(', ']': '[', '}': '{'};

  for (var i = 0; i < src.length; i++) {
    var ch = src[i];

    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '/' && src[i + 1] === '/') return null;   // a comment; give up
    if (ch === '/' && src[i + 1] === '*') return null;
    if (ch === '/') return null;                          // regex or division

    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(' || ch === '[' || (braces && ch === '{')) stack.push(ch);
    else if (ch === ')' || ch === ']' || (braces && ch === '}')) {
      if (stack.pop() !== opens[ch]) return 'unbalanced "' + ch + '"';
    }
  }

  if (quote) return 'unterminated ' + quote + quote + ' string';
  if (stack.length) return 'unbalanced "' + stack[stack.length - 1] + '"';

  return null;
}
