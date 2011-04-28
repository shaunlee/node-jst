# Node JavaScript Template

 Node-jst is a pretty high performance template engine and implemented with JavaScript for Node.js

## Installation

via npm:

    npm install jst

## Features

  * Automatically caching of intermediate JavaScript
  * Unbuffered code for embed codes etc `{% code %}` or `{{ variable }}`

## Example

    {% if (user) { %}
      <h2>{{ user.name }}</h2>
    {% } %}

## Usage

    var jst = require('node-jst');

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

