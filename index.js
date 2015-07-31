var Trumpet = require('trumpet')
var request = require('request')
var url = require('url')
var Duplexify = require('duplexify')
var through2 = require('through2')
var streams2ify = require('streams2')
var URLRewriteStream = require('cssurl').URLRewriteStream
var generateEnvironment = require('./lib/env-gen.js')
var transformJs = require('./lib/transform-js.js').transformJs
var jsTransformStream = require('./lib/transform-js.js').jsTransformStream
var DOM_EVENT_NAMES = require('./lib/dom-events.js')

var proxyServiceUrl = process.env.PROXY_URL
var SCRIPT_OPEN_TAG = '<'+'script'+'>'
var SCRIPT_CLOSE_TAG = '</'+'script'+'>'
var STYLE_OPEN_TAG = '<'+'style'+'>'
var STYLE_CLOSE_TAG = '</'+'style'+'>'

module.exports = DappTransform


function DappTransform(opts) {
  var duplexStream = Duplexify()

  // parse options

  var originUrl = opts.origin
  var origin = url.parse(originUrl)
  var resolveToOrigin = normalizeUrl.bind(null, origin)
  var environment = undefined

  // initialize + setup data flow

  var trumpet = Trumpet()
  trumpet.setMaxListeners(100)

  generateEnvironment(opts, function(err, result){
    if (err) return duplexStream.emit('error', err)
    // initialize
    environment = result
    duplexStream.setReadable(streams2ify(trumpet))
    duplexStream.setWritable(trumpet)
  })

  // configure transformations

  trumpet.selectAll('head', function (node) {
    var readStream = node.createReadStream()
    var writeStream = node.createWriteStream()
    // WRITE environment init script
    writeStream.write(SCRIPT_OPEN_TAG)
    writeStream.write(environment.init)
    writeStream.write(SCRIPT_CLOSE_TAG)
    // insert original content of head
    readStream.pipe(writeStream)
  })

  trumpet.selectAll('script', function (node) {
    var srcUrl = node.getAttribute('src')
    var resolvedUrl = undefined
    var inStream = undefined
    // remote or inline script
    if (srcUrl) {
      node.removeAttribute('src')
      resolvedUrl = resolveToOrigin(srcUrl)
      inStream = request(resolvedUrl)
    } else {
      resolvedUrl = resolveToOrigin('./')
      inStream = node.createReadStream()
    }
    var outStream = node.createWriteStream()
    jsTransformStream(environment, resolvedUrl, inStream, outStream)
  })

  trumpet.selectAll('style', function (node) {
    var resolvedUrl = resolveToOrigin('./')
    var inStream = node.createReadStream()
    var outStream = node.createWriteStream()
    var cssTransform = new URLRewriteStream(function (srcUrl) {
      var resolved = resolveToOrigin(srcUrl)
      var proxied = proxyUrl(resolved)
      return proxied
    })
    
    inStream
    .pipe(cssTransform)
    .pipe(outStream)
  })

  trumpet.selectAll('link[href]', function (node) {
    var srcUrl = node.getAttribute('href')
    node.removeAttribute('href')
    var resolvedUrl = resolveToOrigin(srcUrl)
    var inStream = request(resolvedUrl)
    // overwrite entire node
    var outStream = node.createWriteStream({outer: true})
    outStream.write(STYLE_OPEN_TAG)
    var endTag = through2({}, null, function(cb){
      this.push(STYLE_CLOSE_TAG)
      cb()
    })
    // rewrite urls to resolved, proxied urls
    var cssTransform = new URLRewriteStream(function (srcUrl) {
      var resolved = resolveToOrigin(srcUrl)
      var proxied = proxyUrl(resolved)
      return proxied
    })
    
    inStream
    .pipe(cssTransform)
    .pipe(endTag)
    .pipe(outStream)
  })

  DOM_EVENT_NAMES.forEach(function transformEventHandler(eventName){
    trumpet.selectAll('['+eventName+']', function (node) {
      var src = node.getAttribute(eventName)
      var newSrc = transformJs(src, environment)
      node.setAttribute(eventName, newSrc)
    })
  })

  return duplexStream

}

// utils

function normalizeUrl(origin, srcUrl) {
  var pathname = origin.pathname

  if (pathname.slice(-1) !== '/') pathname += '/'
  var relPath = url.resolve(origin.protocol+'//'+origin.host, pathname)
  var result = url.resolve(relPath, srcUrl)
  // console.log('URL RESOLVE:', srcUrl, '=>', result)
  return result
}

function proxyUrl(target) {
  // whitelist
  if (-1 !== target.indexOf('localhost:3000')) {
    return target
  } else {
    return proxyServiceUrl + '/' + target
  }
}

function noop(){}