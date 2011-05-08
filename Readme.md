# Node JavaScript Template

 Node-jst is a pretty high performance template engine and implemented
 with JavaScript for Node.js

## Installation

via npm:

    npm install jst

## Features

  * Automatically caching of intermediate JavaScript
  * Unbuffered code for embed codes etc `{% code %}` or `{{ variable }}`
  * Enforcing coding standard, for example `{{ variable }}` is correct, but `{{variable}}` is wrong
  * Customizable filters

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

    // Use `it.` as prefix of variables so that you can run it more than 30 times faster
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

## Benchmarks

  [A brief comparison of some JavaScript templating engines on a short
  template: 7 DOM nodes ... 7 interpolated values.][link]

  [link]: http://jsperf.com/dom-vs-innerhtml-based-templating/144

## License 

(The MIT License)

Copyright (c) 2011 Shaun Li <shonhen@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

