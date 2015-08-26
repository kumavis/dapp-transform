const urlUtil = require('url')

const RPC_URL = process.env.RPC_URL || 'https://rpc.metamask.io/'
const PROXY_URL = process.env.PROXY_URL || 'https://proxy.metamask.io/'
const TRANSFORM_BASE_URL = process.env.TRANSFORM_BASE_URL || 'https://transform.metamask.io/'
const TRANSFORM_HTML_URL = process.env.TRANSFORM_HTML_URL || TRANSFORM_BASE_URL + 'html/'
const TRANSFORM_CSS_URL = process.env.TRANSFORM_CSS_URL || TRANSFORM_BASE_URL + 'css/'
const TRANSFORM_JS_URL = process.env.TRANSFORM_JS_URL || TRANSFORM_BASE_URL + 'js/'
const INIT_URL = process.env.INIT_URL || TRANSFORM_BASE_URL+'static/init.js'
const INIT_SCRIPT_TAG = '<'+'script type="text/javascript" src="'+INIT_URL+'"'+'>'+'</'+'script'+'>'
const SCRIPT_OPEN_TAG = '<'+'script'+'>'
const SCRIPT_CLOSE_TAG = '</'+'script'+'>'
const STYLE_OPEN_TAG = '<'+'style'+'>'
const STYLE_CLOSE_TAG = '</'+'style'+'>'

module.exports = {
  generateConfig: generateConfig,
  generateInit: generateInit,
  urlToBaseUrl: urlToBaseUrl,
  resolveUrl: resolveUrl,
  proxyUrl: proxyUrl,
  urlForHtmlTransform: urlForHtmlTransform,
  urlForJsTransform: urlForJsTransform,
  urlForCssTransform: urlForCssTransform,
  noop: noop,
}

// javascript string for 'config' object
function generateConfig(opts) {
  var src = ';document.__VAPOR_CONFIG__ = '+JSON.stringify({
    PROXY_URL: PROXY_URL,
    RPC_URL: RPC_URL,
    BASE_URL: urlToBaseUrl(opts.targetUrl),
  }) + ';'
  return SCRIPT_OPEN_TAG + src + SCRIPT_CLOSE_TAG
}

// html string for 'init' script tag
function generateInit() {
  return INIT_SCRIPT_TAG
}

function urlToBaseUrl(baseUrl){
  // parse origin
  var baseUrlData = urlUtil.parse(baseUrl)
  var path = baseUrlData.path.split('/')
  var pathSuffix = path[path.length-1]
  // if baseUrlData is file, resolve to parent dir
  if (pathSuffix.indexOf('.') !== -1) {
    var amendedPath = path.slice(0,-1).join('/')+'/'
    baseUrl = baseUrlData.protocol+'//'+baseUrlData.host+amendedPath
  }
  return baseUrl
}

function resolveUrl(baseUrlData, srcUrl) {
  var pathname = baseUrlData.pathname

  if (pathname.slice(-1) !== '/') pathname += '/'
  var relPath = urlUtil.resolve(baseUrlData.protocol+'//'+baseUrlData.host, pathname)
  var result = urlUtil.resolve(relPath, srcUrl)
  // console.log('URL RESOLVE:', srcUrl, '=>', result)
  return result
}

function proxyUrl(target) {
  // whitelist localhost
  if (-1 !== target.indexOf('localhost:')) {
    return target
  } else {
    return PROXY_URL + target
  }
}

function urlForHtmlTransform(target) {
  return TRANSFORM_HTML_URL + encodeURIComponent(target)
}

function urlForJsTransform(target) {
  return TRANSFORM_JS_URL + encodeURIComponent(target)
}

function urlForCssTransform(target) {
  return TRANSFORM_CSS_URL + encodeURIComponent(target)
}

function noop(){}