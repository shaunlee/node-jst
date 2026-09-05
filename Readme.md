# Node JavaScript Template

 Node-jst is a pretty high performance template engine and implemented
 with JavaScript for Node.js

## Benchmarks

 `npm run bench`. A 5KB page rendering 20 rows through an HTML-escaping
 filter, every engine producing the same output. Median of three runs of
 best-of-seven, node 26 and bun 1.4 on the same machine.

 With one row in ten containing markup:

                     node 26     bun 1.4
    jst                 544k        553k ops/s
    doT                 321k        466k
    handlebars          263k        252k
    ejs                  56k         95k

 jst skips building a replacement for a value with nothing to escape, which is
 most of them in practice. Where every value does need escaping that shortcut
 only costs, and doT edges ahead:

                     node 26     bun 1.4
    jst                 123k        178k ops/s
    doT                 129k        182k
    handlebars          100k        122k
    ejs                  43k         72k

 The rest of the difference comes from writing `{{ it.name }}` rather than
 `{{ name }}`, which lets the compiler emit a plain function instead of one
 wrapped in `with(it)`. Same page, compiled once and called:

                     node 26     bun 1.4
    it. everywhere      533k        581k ops/s
    bare identifiers     66k        119k
                        8.1x        4.9x

 See [Performance](#performance) for what the compiler can work out for
 itself. Against jst 0.0.13, the last published release, by how the template
 reaches its variables:

                            node 26           bun 1.4
    it. in tags         126k ->  470k     136k ->  543k    3.7x
    it. only in {% %}    75k -> 1442k     103k -> 1979k     19x
    bare identifiers     48k ->   66k      72k ->  118k    1.4x

 The middle row is large because 0.0.13 detected the `it.` prefix with a
 single regex over `{{ }}` tags, so a template using `it.` only inside
 `{% %}` was pushed onto the `with(it)` path. Most of the first row is
 `render()` itself: 0.0.13 hashed the whole template on every call to look it
 up in its cache. Comparing the compiled functions alone, without that, the
 same three rows are 1.2-1.5x, 10-12x and 1.0x.

## Installation

via npm:

    npm install jst

## Features

  * Compiles templates to plain JavaScript functions, cached automatically
  * Unbuffered code for embed codes etc `{% code %}` or `{{ variable }}`
  * Enforcing coding standard: `{{ variable }}` is correct, `{{variable}}` is
    a compile error rather than something that reaches the page
  * Customizable filters
  * Layout whitespace is collapsed, except inside `<pre>` and `<textarea>`
  * Compile errors name the file, the line and the column
  * Runs in the browser from the same source

## Example

    {% if (user) { %}
      <h2>{{ user.name }}</h2>
    {% } %}

## Usage

    var jst = require('jst');

    // Render a string
    jst.render('Hello {{ name }}', {name: 'jst'});

    // Render a file
    jst.renderFile('path/to/some.html', {name: 'jst'}, function(err, ctx) {
      // second arg are optional,
      // the callback can be the second arg
    });

    // Render a file synchronously, sharing the same cache -- for composing
    // views from inside a template, where there is nowhere to put a callback
    jst.renderFileSync('path/to/some.html', {name: 'jst'});

    // Compile a function
    var fn = jst.compile('Hello {{ name }}');
    fn({name: 'jst'});

    // Prefix variables with `it.` to get the fast path -- see Performance
    jst.render('Hello {{ it.name }}', {name: 'jst'});

    // Filters: e (escape), linebreaks, linebreaksbr, add
    jst.render('Hello {{ it.name|e }}', {name: '<strong>jst</strong>'});
    jst.render('{{ it.entry|e|linebreaks }}', {entry: '...'});
    jst.render('{{ it.value|add(123) }}', {value: 123});

    // Custom filters
    jst.addFilter('filterName', function(src) { ... });
    jst.addFilters({anotherFilter: function(src) { ... }});
    jst.render('{{ it.value|filterName }}', {value: 123});
    jst.render('{{ it.value|anotherFilter }}', {value: 123});
    // or
    jst.addFilter('filterName', function(arg1, arg2, arg3) { return function(src) { ... }});
    jst.render('{{ it.value|filterName(1, 2, 3) }}', {value: 123});

    // Client side
    <script src="jst.js"></script>
    <script>
      jst.render('Hello {{ it.name }}', {name: 'jst'});
    </script>

## Syntax

    {{ value }}       an expression, written into the output
    {% code %}        JavaScript, run for its effect
    {# comment #}     dropped at compile time

 The spaces inside the delimiters are part of the syntax, and a `{{` or `{%`
 without them is a compile error rather than text that quietly reaches the
 page:

    jst: unexpected `{{` -- a tag needs spaces inside it, as `{{ name }}`
      at views/index.jst:3:6

      2 | <div>
      3 |     {{name}}
        |     ^
      4 | </div>

 A `|` separates filters, so an expression that needs one -- `||` included --
 either uses it as an operator or keeps it inside brackets:

    {{ it.a || it.b }}          logical or, not two empty filters
    {{ it.f("a|b") }}           inside a string
    {{ (it.n | 0) + 1 }}        bitwise, inside brackets

 To emit a delimiter literally, write it as a string:

    {{ "{{" }}name{{ "}}" }}    renders {{name}}

## Performance

### Write `it.`

 Every variable a template reads has to come from somewhere. Written
 `{{ it.name }}`, the compiler knows where and emits a plain function. Written
 `{{ name }}`, it has to wrap the body in `with(it)`, which neither V8 nor
 JavaScriptCore optimises through. Measured at 2x to 19x depending on the
 template and the engine, and worst on small templates that read several
 variables.

 `npm run bench with` prints the comparison for the page in Benchmarks.

 The compiler decides this from the whole template, not just the `{{ }}` tags,
 so `it.` inside `{% %}` counts too:

    {% for (var i = 0; i < it.rows.length; i++) { %}   <!-- no with(it) -->
    {% for (var i = 0; i < rows.length; i++) { %}      <!-- needs with(it) -->

 Variables the template declares itself are free, so an `it.`-only template
 still gets the fast path:

    {% var total = it.a + it.b %}{{ total }}           <!-- no with(it) -->

 Anything the compiler cannot account for -- a bare identifier, a helper
 injected by `app.locals` -- falls back to `with(it)`. Mixing the two styles is
 always safe; only fully `it.`-prefixed templates get the fast path.

### Caching

 Compiled templates are cached automatically. `renderFile` additionally
 `stat()`s the file on every render to pick up changes, which is what you want
 in development and pure overhead in production:

    jst.configure({cache: true});

 `render()` keys its cache on the template string, and templates built at
 runtime would otherwise accumulate forever, so it holds a bounded number of
 compiled functions and evicts the oldest:

    jst.configure({cacheLimit: 1000});   // the default
    jst.cacheSize();                     // how many are held right now

## Command line

 Compile templates to standalone functions, one per file, on stdout:

    jst path/to/some.jst

 The emitted source expects a `jst` global carrying the filters, which is what
 the browser build provides.

## Development

    npm install
    npm test                 # unit tests plus an end-to-end express check
    npm run bench            # the numbers above; `bun bench/index.js` for bun
    npm run build            # regenerate jst.js (the browser build) from lib/
    node examples/app.js     # http://localhost:3000

 `jst.js` is generated -- edit `lib/` and rebuild. The test suite fails if it
 is stale, and checks that the browser build and the node build agree.

 `examples/` is an express 5 app showing the view engine, code blocks,
 filters, a layout and a partial.

## License

 [MIT](LICENSE)
