/**
 * Decides whether compiled code needs a `with(it)` block.
 *
 * `with` costs 3-30x at render time, so it is worth skipping when every
 * identifier a template touches is either declared by the template itself,
 * a language keyword, a well-known global, or already `it.`-prefixed.
 *
 * Every ambiguity resolves towards `true` (keep `with`): a wrong `true` is
 * only slow, a wrong `false` would break the template.
 */

// Tokens we care about: comments and strings are skipped wholesale, `.foo`
// member access is captured so it is not mistaken for a free identifier.
const tokenre = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'|`(?:[^`\\]|\\[\s\S])*`|(\.\s*)?([A-Za-z_$][\w$]*)|[\s\S]/g,
      keywords = new Set(('var let const function return if else for while do switch case break '
        + 'continue new typeof instanceof in of delete void this null true false undefined '
        + 'try catch finally throw class extends super yield await default with debugger').split(' ')),
      // Built-ins nobody puts on a template context.
      globals = new Set(('Math JSON Date console Number String Array Object Boolean RegExp Error '
        + 'parseInt parseFloat isNaN isFinite NaN Infinity encodeURIComponent decodeURIComponent '
        + 'encodeURI decodeURI Map Set Promise Symbol').split(' ')),
      // Names the generated function provides itself.
      provided = new Set(['it', 'filters', 'out']),
      // Positions after which a `{` opens an object literal rather than a block.
      objectPos = new Set(['(', ',', '=', ':', '[', '?', 'return', '']),
      colonre = /^\s*:/;

exports.needsWith = function(code) {
  var m, declared = new Set(),
      // Declaration state: inside `var a = 1, b = 2` we alternate between
      // expecting a name and reading an initialiser expression.
      declMode = false, expectName = false, depth = 0,
      // `function f(a, b)` / `catch (e)`: every name up to the closing paren
      // is a binding, not a free variable.
      paramMode = 0, paramDepth = 0,
      // Brace kinds, so `{key: v}` keys are not mistaken for variables while
      // `a ? b : c` still is.
      braces = [], prev = '',
      free = [];

  tokenre.lastIndex = 0;

  while ((m = tokenre.exec(code)) !== null) {
    var name = m[2];

    if (name === undefined) {
      var ch = m[0];
      if (ch.trim() === '') continue;
      if (ch === '(' || ch === '[' || ch === '{') {
        if (ch === '{') braces.push(objectPos.has(prev) ? 'obj' : 'block');
        depth++;
        if (paramMode === 1 && ch === '(') { paramMode = 2; paramDepth = depth; }
      } else if (ch === ')' || ch === ']' || ch === '}') {
        if (ch === '}') braces.pop();
        if (paramMode === 2 && depth === paramDepth) paramMode = 0;
        depth--;
        if (depth <= 0) { depth = 0; if (declMode) declMode = expectName = false; }
      } else if (ch === ',') {
        if (declMode && depth === 0) expectName = true;
      } else if (ch === ';') {
        declMode = false; expectName = false;
      }
      prev = ch;
      continue;
    }

    prev = name;

    if (m[1]) continue;                   // `.foo` — a property, not a variable

    if (paramMode === 2) { declared.add(name); continue; }

    if (name === 'function' || name === 'catch') { paramMode = 1; continue; }

    if (name === 'var' || name === 'let' || name === 'const') {
      declMode = true; expectName = true; depth = 0;
      continue;
    }

    if (declMode && expectName && depth === 0) {
      declared.add(name);
      expectName = false;
      continue;
    }

    if (paramMode === 1) { declared.add(name); continue; }   // function name

    if (braces[braces.length - 1] === 'obj' && colonre.test(code.slice(tokenre.lastIndex)))
      continue;                           // object literal key

    if (keywords.has(name) || globals.has(name) || provided.has(name)
        || declared.has(name)) continue;

    free.push(name);
  }

  return free.length > 0;
}

const filterre = /^\s*[A-Za-z_$][\w$]*\s*(?:\(([\s\S]*)\))?\s*$/;

/**
 * Given the parts of a `{{ expr|filter|filter(arg) }}` body, keeps only the
 * code whose identifiers really come from the context: the expression itself
 * and any filter arguments, but not the filter names.
 */
exports.expression = function(parts) {
  return parts.reduce(function(code, part) {
    var m = filterre.exec(part);
    return code + '\n' + (m ? (m[1] || '') : part);
  });
}
