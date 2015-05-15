var meowserify = require('meowserify')
var browserify = require('browserify')
var async = require('async')

module.exports = warmCacheThenGenerate


var CACHE = {}

function warmCacheThenGenerate(opts, cb){

  var inCache = !!(CACHE.init && CACHE.wrapper)

  if (inCache) {
    generateEnvironment(opts, cb)
  } else if (process.browser) {
    CACHE.init = meowserify(__dirname + '/exec-init.js')
    CACHE.wrapper = meowserify(__dirname + '/exec-wrapper.js')
    generateEnvironment(opts, cb)
  } else {
    var initB = browserify([__dirname + '/exec-init.js'])
    var wrapperB = browserify([__dirname + '/exec-wrapper.js'])
    async.parallel([
      initB.bundle.bind(initB),
      wrapperB.bundle.bind(wrapperB),
    ], function(err, results){
      if (err) return cb(err)
      CACHE.init = results[0].toString()
      CACHE.wrapper = results[1].toString()
      generateEnvironment(opts, cb)
    })
  }

}

function generateEnvironment(opts, cb){

  var initSrc = CACHE.init
  var wrapperSrc = CACHE.wrapper

  // build shadowGlobals object
  var shadowWindow = opts.shadowWindow || {}
  var externalGlobals = stringify(shadowWindow)

  // fill in templates
  var initializer = initSrc
    .replace('"INSERT ORIGIN HERE"', '"'+opts.origin+'"')
    .replace('{/* INSERT EXTERNAL WINDOW GLOBALS HERE */}', externalGlobals)
  
  var wrapper = wrapperSrc.split(';;"INSERT CODE HERE";;')

  process.nextTick(
    cb.bind(null, null, {
      init: initializer,
      wrapper: wrapper,
    })
  )

}

function stringify(obj) {
  var output = '{'
  Object.keys(obj).map(function(key){
    output += '\n  "'+key+'": '+obj[key]+','
  })
  output += '\n}'
  return output
}
