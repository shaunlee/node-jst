# Node JavaScript Template

 Node-jst is a pretty high performance template engine and implemented
 with JavaScript for Node.js

## Installation

via npm:

    npm install jst

## Features

  * Compiles templates to plain JavaScript functions, cached automatically
  * Unbuffered code for embed codes etc `{% code %}` or `{{ variable }}`
  * Enforcing coding standard, for example `{{ variable }}` is correct, but `{{variable}}` is wrong
  * Customizable filters
  * Layout whitespace is collapsed, except inside `<pre>` and `<textarea>`
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

    // Compile a function
    var fn = jst.compile('Hello {{ name }}');
    fn({name: 'jst'});

    // Prefix variables with `it.` to get the fast path -- see Performance
    jst.render('Hello {{ it.name }}', {name: 'jst'});

    // Filters
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

## Performance

### Write `it.`

 Every variable a template reads has to come from somewhere. Written
 `{{ it.name }}`, the compiler knows where and emits a plain function. Written
 `{{ name }}`, it has to wrap the body in `with(it)`, which V8 cannot optimise.
 That is worth 2x on a large page and closer to 30x on a small one.

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

### Turn off stat() in production

 Compiled templates are cached automatically. `renderFile` additionally
 `stat()`s the file on every render to pick up changes, which is what you want
 in development but is pure overhead in production:

    jst.configure({cache: true});

## Benchmarks

 Node 26, best of three runs. A 5KB page with 20 HTML-escaped rows, every
 engine producing the same output:

    jst           162k ops/s   1.00x
    doT           168k ops/s   1.04x
    handlebars    119k ops/s   0.73x
    ejs            45k ops/s   0.28x

 What the `it.` prefix is worth, same 5KB page:

    it. everywhere            163k ops/s
    bare identifiers           49k ops/s   0.30x

 Against jst 0.0.14, by template shape:

    5KB page, it. style                    79k -> 163k ops/s    2.1x
    5KB page, bare identifiers             38k ->  49k ops/s    1.3x
    5KB page, it. only inside {% %}        64k -> 2.2M ops/s   34.9x
    small template                        741k -> 2.9M ops/s    3.9x

 The third row is large because 0.0.14 detected the `it.` prefix with a single
 regex over `{{ }}` tags only, so a template using `it.` exclusively inside
 `{% %}` was pushed onto the `with(it)` path.

## Development

    npm install
    npm test                 # unit tests plus an end-to-end express check
    npm run build            # regenerate jst.js (the browser build) from lib/
    node examples/app.js     # http://localhost:3000

 `jst.js` is generated -- edit `lib/` and rebuild. The test suite fails if it
 is stale, and checks that the browser build and the node build agree.

 `examples/` is an express 5 app showing the view engine, a layout, a partial
 and per-request helpers.

## License

(The MIT License)
