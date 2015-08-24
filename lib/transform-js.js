var esquery = require('esquery')
var esprima = require('esprima')
var escodegen = require('escodegen')
var escope = require('escope')
var uniq = require('uniq')
var through2 = require('through2')

// precompiled esquery selectors
// -> "CallExpression:not([callee.type=MemberExpression])"
var NAKED_CALL_AST_SELECTOR = {"type":"compound","selectors":[{"type":"identifier","value":"CallExpression"},{"type":"not","selectors":[{"type":"attribute","name":"callee.type","operator":"=","value":{"type":"literal","value":"MemberExpression"}}]}]}

module.exports = {
  transformJs: transformJs,
  jsTransformStream: jsTransformStream,
}


function transformJs(src, opts) {
  var environment = opts.environment
  var ast = esprima.parse(src)
  // TRANSFORM ast
  transformAstForTopLevelVars(ast)
  transformAstForNakedCalls(ast)
  // GENERATE new src
  var transformedSrc = ''
  transformedSrc += environment.wrapper[0]
  transformedSrc += escodegen.generate(ast)
  transformedSrc += environment.wrapper[1]

  return transformedSrc
}

function jsTransformStream(opts) {
  var jsBuffer = ''
  var transform = through2(bufferChunk, onComplete)

  function bufferChunk(chunk, enc, cb) {
    jsBuffer = jsBuffer + chunk.toString()
    cb()
  }

  function onComplete(cb) {
    try {
      var transformedSrc = transformJs(jsBuffer, opts)
      this.push(transformedSrc)
      cb()
    } catch(err) {
      cb(err)
    }
  }

  return transform
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

// transform top level var declarations to implicit globals
// js has some special behaviour in top-level context
// because of our wrapper, app code is no longer in top-level context
function transformAstForTopLevelVars(ast){
  var topLevelFunctions = []

  var scopeManager = escope.analyze(ast)
  var currentScope = scopeManager.acquire(ast)

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
// appends a variable to the global object
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
// turns a var declaration into an implicit global
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
