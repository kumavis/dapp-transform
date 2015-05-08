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
// -> ":function"
// var WITH_INJECTION_AST_SELECTOR = {"type":"class","name":"function"}

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
    outStream.write(';(function(_window, _document){\n\n')
    outStream.write(environment.wrapper[0])
    outStream.write('\n;;\n\n')

    // WAIT for script to load
    streamToBuffer(inStream, function(err, result){
      var src = result.toString()
      var implicitGlobals = []

      try {

        // WRITE transformed src
        var ast = esprima.parse(src)
        transformAstForWithInjection(ast)
        transformAstForNakedCalls(ast)
        var transformedSrc = escodegen.generate(ast)
        outStream.write(transformedSrc)

        // ANALYZE src for implicit globals
        // implicitGlobals = extractImplicitGlobals(ast)

      } catch(err) {

        console.error('Script transform failed ('+resolvedUrl+'):', err)

      } finally {

        // WRITE end of script wrapper
        var wrapperEnd = environment.wrapper[1]
          .replace('"INSERT IMPLICIT GLOBALS HERE"', JSON.stringify(implicitGlobals))
        outStream.write('\n\n;;'+wrapperEnd)
        outStream.write('\n\n})(window, document);')

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

function transformAstForWithInjection(ast) {

  // TRANSFORM:
  // function(a,b,c){ ... }

  // INTO:
  // function(a,b,c){
  //   var __args__ = {a:a,b:b,c:c};
  //   with(window){
  //     with(__args__){ ... }
  //   }
  // }

  // :function>BlockStatement

  // BEFORE
  //  ├─ type: FunctionExpression <---- match targets here
  //  ├─ id
  //  ├─ params
  //  ├─ defaults
  //  └─ body
  //     ├─ type: BlockStatement
  //     └─ body
  //        └─ 0
  //           ├─ type: ExpressionStatement
  //           └─ expression
  //              ├─ type: Literal
  //              ├─ value: hello
  //              └─ raw: 'hello'

  // AFTER
  // ├─ type: FunctionExpression <---- match targets here
  // ├─ id
  // ├─ params
  // │  ├─ 0
  // │  │  ├─ type: Identifier
  // │  │  └─ name: a
  // │  ├─ 1
  // │  │  ├─ type: Identifier
  // │  │  └─ name: b
  // │  └─ 2
  // │     ├─ type: Identifier
  // │     └─ name: c
  // ├─ defaults
  // └─ body
  //    ├─ type: BlockStatement
  //    └─ body
  //       ├─ 0
  //       │  ├─ type: VariableDeclaration
  //       │  ├─ declarations
  //       │  │  └─ 0
  //       │  │     ├─ type: VariableDeclarator
  //       │  │     ├─ id
  //       │  │     │  ├─ type: Identifier
  //       │  │     │  └─ name: __args__
  //       │  │     └─ init
  //       │  │        ├─ type: ObjectExpression
  //       │  │        └─ properties
  //       │  │           ├─ 0
  //       │  │           │  ├─ type: Property
  //       │  │           │  ├─ key
  //       │  │           │  │  ├─ type: Identifier
  //       │  │           │  │  └─ name: a
  //       │  │           │  ├─ computed: false
  //       │  │           │  ├─ value
  //       │  │           │  │  ├─ type: Identifier
  //       │  │           │  │  └─ name: a
  //       │  │           │  ├─ kind: init
  //       │  │           │  ├─ method: false
  //       │  │           │  └─ shorthand: false
  //       │  │           ├─ 1
  //       │  │           │  ├─ type: Property
  //       │  │           │  ├─ key
  //       │  │           │  │  ├─ type: Identifier
  //       │  │           │  │  └─ name: b
  //       │  │           │  ├─ computed: false
  //       │  │           │  ├─ value
  //       │  │           │  │  ├─ type: Identifier
  //       │  │           │  │  └─ name: b
  //       │  │           │  ├─ kind: init
  //       │  │           │  ├─ method: false
  //       │  │           │  └─ shorthand: false
  //       │  │           └─ 2
  //       │  │              ├─ type: Property
  //       │  │              ├─ key
  //       │  │              │  ├─ type: Identifier
  //       │  │              │  └─ name: c
  //       │  │              ├─ computed: false
  //       │  │              ├─ value
  //       │  │              │  ├─ type: Identifier
  //       │  │              │  └─ name: c
  //       │  │              ├─ kind: init
  //       │  │              ├─ method: false
  //       │  │              └─ shorthand: false
  //       │  └─ kind: var
  //       └─ 1
  //          ├─ type: WithStatement
  //          ├─ object
  //          │  ├─ type: Identifier
  //          │  └─ name: window
  //          └─ body
  //             ├─ type: BlockStatement
  //             └─ body
  //                └─ 0
  //                   ├─ type: WithStatement
  //                   ├─ object
  //                   │  ├─ type: Identifier
  //                   │  └─ name: __args__
  //                   └─ body
  //                      ├─ type: BlockStatement
  //                      └─ body
  //                         └─ 0
  //                            ├─ type: ExpressionStatement
  //                            └─ expression
  //                               ├─ type: Literal
  //                               ├─ value: hello
  //                               └─ raw: 'hello'           


  // all 'function expressions/declarations' need a double 'with'
  // one for injecting 'windowGlobal' properties into context,
  // one for re-injecting function arguments so they don't get trampled by 'windowGlobal' properties

  // var matches = esquery.match(ast, WITH_INJECTION_AST_SELECTOR)
  // uniq(matches)
  // for (var i=0, l=matches.length; i<l; i++) {
  //   var match = matches[i]
  //   var originalBody = match.body.body
  //   match.body.body = [
  //     generateArgsVarDeclaration(match.params),
  //     generateWithStatement('window', [
  //       generateWithStatement('__args__',
  //         originalBody
  //       )
  //     ]),
  //   ]
  // }

  // the 'program' needs a single 'with' for injecting 'windowGlobal' properties into context

  var originalBody = ast.body
  ast.body = [generateWithStatement('window', originalBody)]

}

function generateWithStatement(indentifier, body){
  return {
    type: 'WithStatement',
    object: {
      type: 'Identifier',
      name: indentifier,
    },
    body: {
      type: 'BlockStatement',
      body: body,
    },
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

//
// dead code border patrol
//


// function proxyUrl(location, srcUrl) {
//   var proxyUrl = (location.hostname === 'localhost') ? 'http://localhost:5000/' : 'https://vapor-proxy.herokuapp.com/'
//   var destUrl = proxyUrl+encodeURIComponent(srcUrl)
//   return destUrl
// }
