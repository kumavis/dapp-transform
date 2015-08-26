process.env.TRANSFORM_BASE_URL = 'http://localhost:9021/'

const run = require('browser-run')
const finished = require('tap-finished')
const http = require('http')
const from = require('from')
const browserify = require('browserify')
const wrap = require('wrap-stream')
const eos = require('end-of-stream')
const HtmlTransform = require('./').HtmlTransform
const generateEnvironment = require('./').generateEnvironment


generateEnvironment({}, function(err, environment){

  var server = http.createServer(function (req, res) {
    res.setHeader('content-type', 'application/javascript')
    res.end(environment.init)
  }).listen('9021')

  var browser = run({
    // browser: 'chrome',
    input: 'html',
  })
  var source = browserify('./test/index.js')
  var transform = HtmlTransform({
    targetUrl: 'http://happydapp.io/toothpaste/',
    environment: environment,
  })

  var buildStream = source.bundle()
  var htmlStream = wrap('<html><head></head><body><script>', '</script></body></html>')

  buildStream
  .pipe(htmlStream)
  .pipe(transform)
  .pipe(browser)
  .pipe(process.stdout)

  // setup completion listener
  var tapStream = finished(function (results) {
    browser.stop()
    server.close()
    process.exit( results.ok ? 0 : 1 )
  })
  browser.pipe(tapStream)

})