var Trumpet = require('trumpet')
var request = require('request')
var url = require('url')
var esquery = require('esquery')
var esprima = require('esprima')
var escodegen = require('escodegen')
var escope = require('escope')
var uniq = require('uniq')
var streamToBuffer = require('stream-to-buffer')
var generateEnvironment = require('./lib/env-gen.js')

var SCRIPT_OPEN_TAG = '<'+'script'+'>'
var SCRIPT_CLOSE_TAG = '</'+'script'+'>'

// precompiled esquery selectors
// -> "CallExpression:not([callee.type=MemberExpression])"
var NAKED_CALL_AST_SELECTOR = {"type":"compound","selectors":[{"type":"identifier","value":"CallExpression"},{"type":"not","selectors":[{"type":"attribute","name":"callee.type","operator":"=","value":{"type":"literal","value":"MemberExpression"}}]}]}

module.exports = transformHtml


function transformHtml(opts) {
  var origin = opts.origin
  var location = url.parse(origin)
  var environment = generateEnvironment(opts)

  var trumpet = Trumpet()

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
    transformJs(environment, resolvedUrl, inStream, outStream)
  })

  // trumpet.selectAll('link', function (script) {
  //   var srcUrl = script.getAttribute('href')
  //   if (srcUrl) {
  //     var destUrl = normalizeUrl(srcUrl, location)
  //     destUrl = proxyUrl(location, destUrl)
  //     script.setAttribute('href', destUrl)
  //   } else {
  //     console.warn('vapor rpc - skipped inlined css. ok for now.')
  //   }
  // })

  return trumpet
}

// utils

function transformJs(environment, resolvedUrl, inStream, outStream) {
    // WRITE start of script wrapper
    outStream.write(environment.wrapper[0])

    // WAIT for script to load
    streamToBuffer(inStream, function(err, result){
      var src = result.toString()
      var implicitGlobals = []

      try {

        // TRANSFORM ast
        var ast = esprima.parse(src)
        transformAstForTopLevelVars(ast)
        transformAstForNakedCalls(ast)

        // WRITE transformed src
        var transformedSrc = escodegen.generate(ast)
        outStream.write(transformedSrc)

      } catch(err) {

        console.error('Script transform failed ('+resolvedUrl+'):', err)

      } finally {

        // WRITE end of script wrapper
        outStream.write('\n\n'+environment.wrapper[1])

        // END
        outStream.end()

      }
      
    })

    outStream.on('error', function(err){ throw err })
    inStream.on('error', function(err){ throw err })

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

function transformAstForNakedCalls(ast) {

  // TRANSFORM
  // x()
  // [ but not `x.y()` ]
  // INTO
  // x.call(window)

  // CallExpression:not([callee.type=MemberExpression])

  // BEFORE
  // ├─ type: ExpressionStatement <---- match targets here
  // └─ expression
  //    ├─ type: CallExpression
  //    ├─ callee
  //    │  ├─ type: Identifier
  //    │  └─ name: x
  //    └─ arguments

  // AFTER
  // ├─ type: ExpressionStatement <---- match targets here
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

  var matches = esquery.match(ast, NAKED_CALL_AST_SELECTOR)
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

}


function generateArgsVarDeclaration(fnParams){
  return {
    type: 'VariableDeclaration',
    kind: 'var',
    declarations: [{
      type: 'VariableDeclarator',
      id: {
        type: 'Identifier',
        name: '__args__',
      },
      init: {
        type: 'ObjectExpression',
        properties: fnParams.map(function(param){
          return {
            type: 'Property',
            key: {
              type: 'Identifier',
              name: param.name,
            },
            computed: false,
            value: {
              type: 'Identifier',
              name: param.name,
            },
            kind: 'init',
            method: false,
            shorthand: false,
          }
        }),
      },
    }],
  }
}

function transformAstForTopLevelVars(ast){
  var topLevelFunctions = []

  var scopeManager = escope.analyze(ast)
  var currentScope = scopeManager.acquire(ast)

  // transform top level var declarations to implicit globals
  currentScope.variables.forEach(function(variable){
    variable.defs.forEach(function(def){

      switch(def.node.type) {
    
        case 'VariableDeclarator':
          transformVarDeclarationToAssignment(def)
          break

        case 'FunctionDeclaration':
          topLevelFunctions.push(def.node.id)
          break

      }

    })
  })

  // append top level functions to global
  topLevelFunctions.forEach(function(id){
    var node = implicitGlobalFnAssignment(id)
    ast.body.unshift(node)
  })

}

// creates an ast node for window.`id` = `id`
function implicitGlobalFnAssignment(id){
  return {
    type: 'ExpressionStatement',
    expression: {
      type: 'AssignmentExpression',
      operator: '=',
      left: {
        type: 'MemberExpression',
        computed: false,
        object: {
          type: 'Identifier',
          name: 'window',
        },
        property: id,
      },
      right: id,
    },
  }
}

// transforms var declaration nodes in place
function transformVarDeclarationToAssignment(def) {
  var target = def.parent
  var identifier = def.node.id
  var init = def.node.init

  target.type = 'ExpressionStatement'
  target.expression = {
    type: 'AssignmentExpression',
    operator: '=',
    left: identifier,
    right: init,
  }

  delete target.kind
  delete target.declarations
}


//
// dead code border patrol
//


// function proxyUrl(location, srcUrl) {
//   var proxyUrl = (location.hostname === 'localhost') ? 'http://localhost:5000/' : 'https://vapor-proxy.herokuapp.com/'
//   var destUrl = proxyUrl+encodeURIComponent(srcUrl)
//   return destUrl
// }
