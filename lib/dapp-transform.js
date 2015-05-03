var Trumpet = require('trumpet')
var request = require('request')
var url = require('url')
var esquery = require('esquery')
var esprima = require('esprima')
var escodegen = require('escodegen')
var escope = require('escope')
var uniq = require('uniq')
var generateEnvironment = require('./env-gen.js')

module.exports = transformHtml


function transformHtml(origin) {

  var location = url.parse(origin)
  var environment = generateEnvironment(origin)

  var trumpet = Trumpet()

  trumpet.selectAll('head', function (node) {
    var readStream = node.createReadStream()
    var writeStream = node.createWriteStream()
    writeStream.write('<'+'script'+'>')
    writeStream.write(environment.init)
    writeStream.write('</'+'script'+'>')
    // insert original content of head
    readStream.pipe(writeStream)
  })

  // console.log('expecting transforms...')
  trumpet.selectAll('script', function (node) {

    // console.log('Object.keys(node)=============')
    // console.log(Object.keys(node))
    var srcUrl = node.getAttribute('src')
    
    if (srcUrl) {

      var destUrl = normalizeUrl(srcUrl, location)

      node.removeAttribute('src')
      var nodeStream = node.createWriteStream()
      nodeStream.write(';(function(_window, _document){\n\n')
      nodeStream.write(environment.wrapper[0])
      nodeStream.write(';;\n\n')
      var srcBuffer = new Buffer([])
      var getStream = request( destUrl )
      getStream.on('data', function(data){
        srcBuffer = Buffer.concat([srcBuffer, data])
      })
      getStream.on('end', function(data){
        var wrapperEnd = environment.wrapper[1]
        var src = srcBuffer.toString()
        var ast = esprima.parse(src)
        
        var newSrc = transformSrc(ast)
        nodeStream.write(newSrc)

        var program = ast
        var implicitGlobals = extractImplicitGlobals(program)
        wrapperEnd = wrapperEnd.replace('"INSERT IMPLICIT GLOBALS HERE"', JSON.stringify(implicitGlobals))
        nodeStream.write('\n\n;;'+wrapperEnd)
        
        nodeStream.write('\n\n})(window, document);')
        nodeStream.end()
      })

      nodeStream.on('error', function(err){ throw err })
      getStream.on('error', function(err){ throw err })

    } else {

      console.warn('vapor rpc - skipped inlined script. not ok.')

    }

  })

  trumpet.selectAll('link', function (script) {
    
    var srcUrl = script.getAttribute('href')
    if (srcUrl) {

      var destUrl = normalizeUrl(srcUrl, location)
      destUrl = proxyUrl(location, destUrl)
      script.setAttribute('href', destUrl)

    } else {

      console.warn('vapor rpc - skipped inlined css. ok for now.')

    }

  })

  return trumpet
}

function normalizeUrl(srcUrl, origin) {
  var pathname = origin.pathname

  if (pathname.slice(-1) !== '/') pathname += '/'
  var relPath = url.resolve(origin.protocol+'//'+origin.host, pathname)
  // console.log(origin.host, pathname, '=>', relPath)
  var result = url.resolve(relPath, srcUrl)
  // console.log(relPath, srcUrl, '=>', result)
  return result
}

function proxyUrl(location, srcUrl) {
  var proxyUrl = (location.hostname === 'localhost') ? 'http://localhost:5000/' : 'https://vapor-proxy.herokuapp.com/'
  var destUrl = proxyUrl+encodeURIComponent(srcUrl)
  return destUrl
}

function extractImplicitGlobals(ast){
  var scopeManager = escope.analyze(ast)
  var currentScope = scopeManager.acquire(ast)
  var topLevelVars = currentScope.variables.map(function(variable){ return variable.name })
  var globalVars = currentScope.implicit.variables.map(function(variable){ return variable.name })
  var implicitGlobals = [].concat.call(topLevelVars, globalVars)
  return implicitGlobals
}

var looseThisContextSelector = esquery.parse('CallExpression:not([callee.type=MemberExpression])')
function transformSrc(ast) {

  // transform `x()` to `x.call(window)` [ but not `x.y()` ]

  // CallExpression:not([callee.type=MemberExpression])

  // BEFORE
  // ├─ type: ExpressionStatement
  // └─ expression
  //    ├─ type: CallExpression
  //    ├─ callee
  //    │  ├─ type: Identifier
  //    │  └─ name: x
  //    └─ arguments

  // AFTER
  // ├─ type: ExpressionStatement
  // └─ expression
  //    ├─ type: CallExpression
  //    ├─ callee
  //    │  ├─ type: MemberExpression
  //    │  ├─ computed: false
  //    │  ├─ object
  //    │  │  ├─ type: Identifier
  //    │  │  └─ name: x
  //    │  └─ property
  //    │     ├─ type: Identifier
  //    │     └─ name: call
  //    └─ arguments
  //       └─ 0
  //          ├─ type: Identifier
  //          └─ name: window

  var matches = esquery.match(ast, looseThisContextSelector)
  uniq(matches)
  for (var i=0, l=matches.length; i<l; i++) {
    var match = matches[i]
    var originalCallee = match.callee
    match.callee = {
      type: 'MemberExpression',
      object: originalCallee,
      property: { type: 'Identifier', name: 'call' },
      computed: false,
    }
    match.arguments.unshift({ type: 'Identifier', name: 'window' })
  }

  // generate code for ast
  return escodegen.generate(ast)

}