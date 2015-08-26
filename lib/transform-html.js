const Trumpet = require('trumpet')
const request = require('request')
const urlUtil = require('url')
const Duplexify = require('duplexify')
const through2 = require('through2')
const streams2ify = require('streams2')
const generateEnvironment = require('./env-gen.js')
const transformJs = require('./transform-js.js').transformJs
const jsTransformStream = require('./transform-js.js').jsTransformStream
const cssTransformStream = require('./transform-css.js')
const util = require('./util.js')
const domEventNames = require('./dom-events.js')


module.exports = HtmlTransform


function HtmlTransform(opts) {
  var duplexStream = Duplexify()

  // parse origin
  var baseUrl = util.urlToBaseUrl(opts.targetUrl)
  var baseUrlData = urlUtil.parse(baseUrl)
  var resolveToBase = util.resolveUrl.bind(null, baseUrlData)

  // initialize + setup data flow

  var trumpet = Trumpet()
  trumpet.setMaxListeners(100)
  
  duplexStream.setReadable(streams2ify(trumpet))
  duplexStream.setWritable(trumpet)

  // configure transformations

  trumpet.selectAll('head', function (node) {
    var readStream = node.createReadStream()
    var writeStream = node.createWriteStream()
    // WRITE environment init script tag
    writeStream.write(util.generateConfig(opts))
    writeStream.write(util.generateInit())
    // insert original content of head
    readStream.pipe(writeStream)
  })

  // inline + external scripts
  trumpet.selectAll('script', function (node) {
    var srcUrl = node.getAttribute('src')
    
    // external script
    if (srcUrl) {
      var resolvedUrl = resolveToBase(srcUrl)
      var newUrl = util.urlForJsTransform(resolvedUrl)
      node.setAttribute('src', newUrl)
    
    // inline script
    } else {
      var resolvedUrl = resolveToBase('./')
      var inStream = node.createReadStream()
      var outStream = node.createWriteStream()
      var transform = jsTransformStream(opts)
      
      inStream
      .pipe(transform)
      .pipe(outStream)
    }
  })

  // inline styles
  trumpet.selectAll('style', function (node) {
    var inStream = node.createReadStream()
    var outStream = node.createWriteStream()
    var transform = cssTransformStream(opts)
    
    inStream
    .pipe(transform)
    .pipe(outStream)
  })

  // external styles
  trumpet.selectAll('link[href]', function (node) {
    var srcUrl = node.getAttribute('href')
    // node.removeAttribute('href')
    var resolvedUrl = resolveToBase(srcUrl)
    var newUrl = util.urlForCssTransform(resolvedUrl)
    node.setAttribute('href', newUrl)
  })

  // anchor tags
  trumpet.selectAll('a[href]', function (node) {
    var srcUrl = node.getAttribute('href')
    var resolvedUrl = resolveToBase(srcUrl)
    var transformUrl = util.urlForHtmlTransform(resolvedUrl)
    node.setAttribute('href', transformUrl)
  })

  domEventNames.forEach(transformInlineEventHandler)

  function transformInlineEventHandler(eventName){
    trumpet.selectAll('['+eventName+']', function (node) {
      var src = node.getAttribute(eventName)
      var newSrc = transformJs(src, opts)
      node.setAttribute(eventName, newSrc)
    })
  }

  return duplexStream

}
