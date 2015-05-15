var Trumpet = require('trumpet')
var request = require('request')
var url = require('url')
var Duplexify = require('duplexify')
var generateEnvironment = require('./lib/env-gen.js')
var transformJs = require('./lib/transform-js.js').transformJs
var jsTransformStream = require('./lib/transform-js.js').jsTransformStream
var DOM_EVENT_NAMES = require('./lib/dom-events.js')

var SCRIPT_OPEN_TAG = '<'+'script'+'>'
var SCRIPT_CLOSE_TAG = '</'+'script'+'>'

module.exports = DappTransform


function DappTransform(opts) {
  var duplexStream = Duplexify()

  // parse options

  var origin = opts.origin
  var location = url.parse(origin)
  var environment = undefined

  // initialize + setup data flow

  var trumpet = Trumpet()
  trumpet.setMaxListeners(100)

  generateEnvironment(opts, function(err, result){
    if (err) return duplexStream.emit('error', err)
    // initialize
    environment = result
    duplexStream.setReadable(trumpet)
    duplexStream.setWritable(trumpet)
  })

  // configure transformations

  trumpet.selectAll('head', function (node) {
    var readStream = node.createReadStream()
    var writeStream = node.createWriteStream()
    // WRITE base tag
    var baseTag = '<base href="'+origin+'" target="_blank">'
    writeStream.write(baseTag)
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
      resolvedUrl = normalizeUrl(srcUrl, location)
      inStream = request(resolvedUrl)
    } else {
      resolvedUrl = normalizeUrl('./', location)
      inStream = node.createReadStream()
    }
    var outStream = node.createWriteStream()
    jsTransformStream(environment, resolvedUrl, inStream, outStream)
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

function normalizeUrl(srcUrl, origin) {
  var pathname = origin.pathname

  if (pathname.slice(-1) !== '/') pathname += '/'
  var relPath = url.resolve(origin.protocol+'//'+origin.host, pathname)
  // console.log(origin.host, pathname, '=>', relPath)
  var result = url.resolve(relPath, srcUrl)
  // console.log(relPath, srcUrl, '=>', result)
  return result
}

function noop(){}