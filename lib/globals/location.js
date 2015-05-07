var url = require('url')

module.exports = FakeLocation


function FakeLocation(origin) {
  this._origin = url.parse(origin)
  this.replace(origin)
  Object.defineProperty(this, 'origin', {
    get: function(){
      var output = ''
      output += this._origin.protocol || ''
      output += (this._origin.slashes ? '//' : '')
      output += this._origin.host || ''
      return output
    },
    set: function(value){
      throw notImplemented('set location.origin')
    },
  })
  Object.defineProperty(this, 'hash', {
    get: function(){
      return decodeURIComponent(this._origin.hash || '')
    },
    set: function(value){
      if (value.charAt(0) !== '#') value = '#'+value
      this._origin.hash = value
      return value
    },
  })
  Object.defineProperty(this, 'search', {
    get: function(){
      return this._origin.search || ''
    },
    set: function(value){
      throw notImplemented('set location.search')
    },
  })
  Object.defineProperty(this, 'pathname', {
    get: function(){
      return this._origin.pathname || ''
    },
    set: function(value){
      throw notImplemented('set location.pathname')
    },
  })
  Object.defineProperty(this, 'port', {
    get: function(){
      return this._origin.port || ''
    },
    set: function(value){
      throw notImplemented('set location.port')
    },
  })
  Object.defineProperty(this, 'hostname', {
    get: function(){
      return this._origin.hostname
    },
    set: function(value){
      throw notImplemented('set location.hostname')
    },
  })
  Object.defineProperty(this, 'host', {
    get: function(){
      return this._origin.host
    },
    set: function(value){
      throw notImplemented('set location.host')
    },
  })
  Object.defineProperty(this, 'protocol', {
    get: function(){
      var protocol = this._origin.protocol
      // if (protocol.slice(-2) === '//') protocol = protocol.slice(0,-2)
      return protocol
    },
    set: function(value){
      throw notImplemented('set location.protocol')
    },
  })
  Object.defineProperty(this, 'href', {
    get: function(){
      var origin = this._origin
      var output = ''
      output += this.origin
      output += this.pathname
      output += origin.search || ''
      output += origin.hash || ''
      return output
    },
    set: function(value){
      this.replace(value)
      return value
    },
  })
}
FakeLocation.prototype.replace = function(val){
  this._origin = url.parse(this._origin.resolve(val))
}

function notImplemented(methodName) {
  return new Error('Vapor - Not Implemented - '+methodName)
}