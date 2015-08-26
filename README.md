provides fine-grained control over an html5 app
by transforming html, css, and js


anatomy of html transforms

script tags injected at top:
* config (small, dynamic)
* initialization (large, static)

modified script tag:
* wrapper start (small, static)
* app src script (after AST transform)
* wrapper end (small, static)

wrapper + AST transformations ensure all references to 'window' or 'document'
actually reference the 'fakeWindow' and 'fakeDocument' created in the initialization


# DOM notes

### navigation and routing

app routing happens in a number of ways.

html anchors are used to nagivate to:
  * same page navigation (via a named anchor)
  * a relative location
  * an external location
  
js navigation can work in a number of ways:
  * update window.location
  * history api
  * internal state change