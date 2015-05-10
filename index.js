var Trumpet = require('trumpet')
var request = require('request')
var url = require('url')
var generateEnvironment = require('./lib/env-gen.js')
var transformJs = require('./lib/transform-js.js').transformJs
var jsTransformStream = require('./lib/transform-js.js').jsTransformStream

var SCRIPT_OPEN_TAG = '<'+'script'+'>'
var SCRIPT_CLOSE_TAG = '</'+'script'+'>'

module.exports = transformHtml


function transformHtml(opts) {
  var origin = opts.origin
  var location = url.parse(origin)
  var environment = generateEnvironment(opts)

  var trumpet = Trumpet()
  trumpet.setMaxListeners(100)

  var sawHeadTag = false

  trumpet.selectAll('head', function (node) {
    sawHeadTag = true
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
      inStream = request(destUrl)
    } else {
      resolvedUrl = normalizeUrl('./', location)
      inStream = node.createReadStream()
    }
    var outStream = node.createWriteStream()
    jsTransformStream(environment, resolvedUrl, inStream, outStream)
  })

  // Mouse Events
  transformEventHandler('onclick')
  transformEventHandler('oncontextmenu')
  transformEventHandler('ondblclick')
  transformEventHandler('onmousedown')
  transformEventHandler('onmouseenter')
  transformEventHandler('onmouseleave')
  transformEventHandler('onmousemove')
  transformEventHandler('onmouseover')
  transformEventHandler('onmouseout')
  transformEventHandler('onmouseup')
  // Keyboard Events
  transformEventHandler('onkeydown')
  transformEventHandler('onkeypress')
  transformEventHandler('onkeyup')
  // Frame/Object Events
  transformEventHandler('onabort')
  transformEventHandler('onbeforeunload')
  transformEventHandler('onerror')
  transformEventHandler('onhashchange')
  transformEventHandler('onload')
  transformEventHandler('onpageshow')
  transformEventHandler('onpagehide')
  transformEventHandler('onresize')
  transformEventHandler('onscroll')
  transformEventHandler('onunload')
  // Form Events
  transformEventHandler('onblur')
  transformEventHandler('onchange')
  transformEventHandler('onfocus')
  transformEventHandler('onfocusin')
  transformEventHandler('onfocusout')
  transformEventHandler('oninput')
  transformEventHandler('oninvalid')
  transformEventHandler('onreset')
  transformEventHandler('onsearch')
  transformEventHandler('onselect')
  transformEventHandler('onsubmit')
  // Drag Events
  transformEventHandler('ondrag')
  transformEventHandler('ondragend')
  transformEventHandler('ondragenter')
  transformEventHandler('ondragleave')
  transformEventHandler('ondragover')
  transformEventHandler('ondragstart')
  transformEventHandler('ondrop')
  // Clipboard Events
  transformEventHandler('oncopy')
  transformEventHandler('oncut')
  transformEventHandler('onpaste')
  // Print Events
  transformEventHandler('onafterprint')
  transformEventHandler('onbeforeprint')
  // Media Events
  transformEventHandler('onabort')
  transformEventHandler('oncanplay')
  transformEventHandler('oncanplaythrough')
  transformEventHandler('ondurationchange')
  transformEventHandler('onemptied')
  transformEventHandler('onended')
  transformEventHandler('onerror')
  transformEventHandler('onloadeddata')
  transformEventHandler('onloadedmetadata')
  transformEventHandler('onloadstart')
  transformEventHandler('onpause')
  transformEventHandler('onplay')
  transformEventHandler('onplaying')
  transformEventHandler('onprogress')
  transformEventHandler('onratechange')
  transformEventHandler('onseeked')
  transformEventHandler('onseeking')
  transformEventHandler('onstalled')
  transformEventHandler('onsuspend')
  transformEventHandler('ontimeupdate')
  transformEventHandler('onvolumechange')
  transformEventHandler('onwaiting')
  // Animation Events
  transformEventHandler('animationend')
  transformEventHandler('animationiteration')
  transformEventHandler('animationstart')
  // Transition Events
  transformEventHandler('transitionend')
  // Server-Sent Events
  transformEventHandler('onerror')
  transformEventHandler('onmessage')
  transformEventHandler('onopen')
  // Misc Events
  transformEventHandler('onmessage')
  transformEventHandler('onmousewheel')
  transformEventHandler('ononline')
  transformEventHandler('onoffline')
  transformEventHandler('onpopstate')
  transformEventHandler('onshow')
  transformEventHandler('onstorage')
  transformEventHandler('ontoggle')
  transformEventHandler('onwheel')
  // Touch Events
  transformEventHandler('ontouchcancel')
  transformEventHandler('ontouchend')
  transformEventHandler('ontouchmove')
  transformEventHandler('ontouchstart')

  function transformEventHandler(event){
    trumpet.selectAll('['+event+']', function (node) {
      var src = node.getAttribute(event)
      var newSrc = transformJs(src, environment)
      node.setAttribute(event, newSrc)
    })
  }

  return trumpet
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


//
// dead code border patrol
//


// function proxyUrl(location, srcUrl) {
//   var proxyUrl = (location.hostname === 'localhost') ? 'http://localhost:5000/' : 'https://vapor-proxy.herokuapp.com/'
//   var destUrl = proxyUrl+encodeURIComponent(srcUrl)
//   return destUrl
// }
