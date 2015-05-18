var esquery = require('esquery')
var esprima = require('esprima')
var escodegen = require('escodegen')
var escope = require('escope')
var streamToBuffer = require('stream-to-buffer')
var uniq = require('uniq')

// precompiled esquery selectors
// -> "CallExpression:not([callee.type=MemberExpression])"
var NAKED_CALL_AST_SELECTOR = {"type":"compound","selectors":[{"type":"identifier","value":"CallExpression"},{"type":"not","selectors":[{"type":"attribute","name":"callee.type","operator":"=","value":{"type":"literal","value":"MemberExpression"}}]}]}

module.exports = {
  transformJs: transformJs,
  jsTransformStream: jsTransformStream,
}


function transformJs(src, environment) {
  // TRANSFORM ast
  var ast = esprima.parse(src)
  transformAstForTopLevelVars(ast)
  transformAstForNakedCalls(ast)
  // GENERATE new src
  var transformedSrc = ''
  transformedSrc += environment.wrapper[0]
  transformedSrc += escodegen.generate(ast)
  transformedSrc += environment.wrapper[1]

  return transformedSrc
}

function jsTransformStream(environment, resolvedUrl, inStream, outStream) {
  // WAIT for script to load
  streamToBuffer(inStream, function(err, result){
    var src = result.toString()

    try {
      var transformedSrc = transformJs(src, environment)
      outStream.write(transformedSrc)
    } catch(err) {
      console.error('Script transform failed ('+resolvedUrl+'):', err)
    } finally {
      // END
      outStream.end()
    }
    
  })

  outStream.on('error', function(err){ throw err })
  inStream.on('error', function(err){ throw err })
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
