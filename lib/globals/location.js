var url = require('url')

module.exports = FakeLocation


function FakeLocation(origin) {
  this._origin = url.parse(origin)
  this.replace(origin)
  Object.defineProperty(this, 'href', {
    get: function(){
      var origin = this._origin
      var output = ''
      output += origin.protocol || ''
      output += (origin.slashes ? '//' : '')
      output += origin.host || ''
      output += origin.pathname
      output += origin.search || ''
      output += origin.hash || ''
      return output
    },
    set: function(value){
      this.replace(value)
      return value
    },
  })
  Object.defineProperty(this, 'hash', {
    get: function(){
      return this._origin.hash || ''
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
      this._origin.search = value
      return value
    },
  })
}
FakeLocation.prototype.replace = function(val){
  this._origin = url.parse(this._origin.resolve(val))
}