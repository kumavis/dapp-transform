var meowserify = require('meowserify')
var browserify = require('browserify')
var async = require('async')

module.exports = environmentGenerator


function environmentGenerator(opts, cb){

  var work = []

  if (process.browser) {
    work.push(function(cb){
      cb(null, meowserify(__dirname + '/exec-init.js'))
    })
    work.push(function(cb){
      cb(null, meowserify(__dirname + '/exec-wrapper.js'))
    })
  } else {
    var initB = browserify([__dirname + '/exec-init.js'])
    var wrapperB = browserify([__dirname + '/exec-wrapper.js'])
    work.push( initB.bundle.bind(initB) )
    work.push( wrapperB.bundle.bind(wrapperB) )
  }

  async.parallel(work, function(err, results){
    if (err) return cb(err)

    var initSrc = results[0].toString()
    var wrapperSrc = results[1].toString()

    // build shadowGlobals object
    var shadowWindow = opts.shadowWindow || {}
    var externalGlobals = '{'
    Object.keys(shadowWindow).map(function(key){
      externalGlobals += '\n  "'+key+'": '+shadowWindow[key]+','
    })
    externalGlobals += '\n}'

    // fill in templates
    var initializer = initSrc
      .replace('"INSERT ORIGIN HERE"', '"'+opts.origin+'"')
      .replace('{/* INSERT EXTERNAL WINDOW GLOBALS HERE */}', externalGlobals)
    
    var wrapper = wrapperSrc.split(';;"INSERT CODE HERE";;')

    cb(null, {
      init: initializer,
      wrapper: wrapper,
    })

  })

}