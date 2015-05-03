module.exports = FakeHistory

/* minimal fake history implementation */

function FakeHistory(origin) {
  this._origin = origin
  this._stateIndex = 0
  this._stateStack = [null]
  Object.defineProperty(this, 'state', {
    get: function(){
      return this._stateStack[this._stateIndex]
    },
    set: function(value){
      this._stateStack[this._stateIndex] = value
      return value
    },
  })
}
FakeHistory.prototype.back = function(value) {
  debugger
}
FakeHistory.prototype.forward = function(value) {
  debugger
}
FakeHistory.prototype.go = function(value) {
  debugger
}
FakeHistory.prototype.pushState = function(stateObj, name, url) {
  debugger
}
FakeHistory.prototype.replaceState = function(stateObj, name, url) {
  this.state = stateObj
}