var meowserify = require('meowserify')
var initSrc = meowserify(__dirname + '/exec-init.js')
var wrapperSrc = meowserify(__dirname + '/exec-wrapper.js')

module.exports = environmentGenerator


function environmentGenerator(opts){

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
  var wrapper = wrapperSrc.split('"INSERT CODE HERE"')

  return {
    init: initializer,
    wrapper: wrapper,
  }

}