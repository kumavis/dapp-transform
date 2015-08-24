var meowserify = require('meowserify')
var browserify = require('browserify')
var async = require('async')

module.exports = generateEnvironment

/*

This is an isomorphic browserify bundler.
It will generate some code used in the transforms.
This generated code is a template that needs somethings injected.
This generated code is not dynamic and only needs to be generated once.

externalGlobals is a way to add things to the global context

*/

function generateEnvironment(opts, cb){
  opts = opts || {}

  if (process.browser) {
    var initJs = meowserify(__dirname + '/exec-init.js')
    var wrapperJs = meowserify(__dirname + '/exec-wrapper.js')
    finalizeEnv(opts, initJs, wrapperJs, cb)
  } else {
    var initB = browserify([__dirname + '/exec-init.js'])
    var wrapperB = browserify([__dirname + '/exec-wrapper.js'])
    async.parallel([
      initB.bundle.bind(initB),
      wrapperB.bundle.bind(wrapperB),
    ], function(err, results){
      if (err) return cb(err)
      var initJs = results[0].toString()
      var wrapperJs = results[1].toString()
      finalizeEnv(opts, initJs, wrapperJs, cb)
    })
  }

}

function finalizeEnv(opts, initJs, wrapperJs, cb){
  
  var externalGlobals = opts.externalGlobals || {}
  var externalGlobalsJs = stringifyExternalGlobals(externalGlobals)

  var init = initJs.replace('{/* INSERT EXTERNAL GLOBALS HERE */}', externalGlobalsJs)
  var wrapper = wrapperJs.split(';;"INSERT CODE HERE";;')

  process.nextTick(
    cb.bind(null, null, {
      init: init,
      wrapper: wrapper,
    })
  )

}

// generates a code string for an object literal
// from an obj where the values are code strings
// { a: '1+2' } -> "{ a: 1+2 }"
function stringifyExternalGlobals(obj) {
  var output = '{'
  Object.keys(obj).map(function(key){
    output += '\n  "'+key+'": '+obj[key]+','
  })
  output += '\n}'
  return output
}