const urlUtil = require('url')

// this is a little hacky b/c we are sometimes reading from the CONFIG in browser
// and sometimes from the env vars in node -- util is used in both
// need to unify config

const VAPOR_CONFIG = ((typeof document !== 'undefined') && document.__VAPOR_CONFIG__) || {}
const RPC_URL = process.env.RPC_URL || 'https://rpc.metamask.io/'
const PROXY_URL = process.env.PROXY_URL || 'https://proxy.metamask.io/'
const TRANSFORM_BASE_URL = VAPOR_CONFIG.TRANSFORM_BASE_URL || process.env.TRANSFORM_BASE_URL || 'https://transform.metamask.io/'
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
  generateBaseTag: generateBaseTag,
  generateConfig: generateConfig,
  generateInit: generateInit,
  urlToBaseUrl: urlToBaseUrl,
  resolveUrl: resolveUrl,
  proxyUrl: proxyUrl,
  transformUrlForLocalNav: transformUrlForLocalNav,
  urlForHtmlTransform: urlForHtmlTransform,
  urlForJsTransform: urlForJsTransform,
  urlForCssTransform: urlForCssTransform,
  noop: noop,
}

function generateBaseTag(baseUrl){
  return '<'+'base href="'+baseUrl+'">'
}

// javascript string for 'config' object
function generateConfig(opts) {
  var src = ';document.__VAPOR_CONFIG__ = '+JSON.stringify({
    PROXY_URL: PROXY_URL,
    RPC_URL: RPC_URL,
    TRANSFORM_BASE_URL: TRANSFORM_BASE_URL,
    BASE_URL: urlToBaseUrl(opts.targetUrl),
  }) + ';'
  return SCRIPT_OPEN_TAG + src + SCRIPT_CLOSE_TAG
}

// html string for 'init' script tag
function generateInit() {
  return INIT_SCRIPT_TAG
}

// get the 'current directory' of a url
function urlToBaseUrl(targetUrl){
  // parse origin
  var baseUrl = targetUrl
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

// resolve a relative url against a base url
function resolveUrl(baseUrlData, srcUrl) {
  if (typeof baseUrlData === 'string') {
    baseUrlData = urlUtil.parse(baseUrlData)
  }
  var pathname = baseUrlData.pathname

  if (pathname.slice(-1) !== '/') pathname += '/'
  var relPath = urlUtil.resolve(baseUrlData.protocol+'//'+baseUrlData.host, pathname)
  var result = urlUtil.resolve(relPath, srcUrl)
  // console.log('URL RESOLVE:', srcUrl, '=>', result)
  return result
}

function transformUrlForLocalNav(targetUrl) {
  var baseUrl = document.__VAPOR_CONFIG__.BASE_URL
  var resolvedUrl = resolveUrl(baseUrl, targetUrl)
  var localUrl = urlForHtmlTransform(resolvedUrl)
  return localUrl
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