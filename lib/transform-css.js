const URLRewriteStream = require('cssurl').URLRewriteStream
const util = require('./util.js')
const urlUtil = require('url')

module.exports = cssTransformStream


function cssTransformStream(opts){
  var baseUrl = util.urlToBaseUrl(opts.targetUrl)
  var baseUrlData = urlUtil.parse(baseUrl)
  var transform = new URLRewriteStream(function (srcUrl) {
    var resolved = util.resolveUrl(baseUrlData, srcUrl)
    var proxied = util.proxyUrl(resolved)
    return proxied
  })
  return transform
}