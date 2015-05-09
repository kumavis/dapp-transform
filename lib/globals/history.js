module.exports = FakeHistory

/* minimal fake history implementation */

function FakeHistory(origin, location) {
  this._origin = origin
  this._location = location
  this._stateIndex = 0
  this._stateStack = [{
    name: '',
    value: null,
    url: origin.href,
  }]
  Object.defineProperty(this, 'state', {
    get: function(){
      return this._stateStack[this._stateIndex].value
    },
    set: function(value){
      return value
    },
  })
}
FakeHistory.prototype.back = function(value) {
  this._stateIndex--
  if (this._stateIndex < 0) {
    this._stateIndex = 0
  } else {
    // trigger location update
    var target = this._stateStack[this._stateIndex].url
    this._location.replace(target)
  }
}
FakeHistory.prototype.forward = function(value) {
  this._stateIndex++
  if (this._stateIndex > this._stateStack.length-1) {
    this._stateIndex = this._stateStack.length-1
  } else {
    // trigger location update
    var target = this._stateStack[this._stateIndex].url
    this._location.replace(target)
  }
}
FakeHistory.prototype.go = function(value) {
  debugger
}
FakeHistory.prototype.pushState = function(stateObj, name, url) {
  var currentState = {
    value: stateObj,
    name: name,
    url: url,
  }
  // cut off stack at current position
  this._stateStack = this._stateStack.slice(0,this._stateIndex+1)
  // add new state obj
  this._stateStack.push(currentState)
  // bump index
  this._stateIndex++
  // trigger location update
  this._location.replace(url)
}
FakeHistory.prototype.replaceState = function(stateObj, name, url) {
  var currentState = {
    value: stateObj,
    name: name,
    url: url,
  }
  this._stateStack[this._stateIndex] = currentState
  // trigger location update
  this._location.replace(url)
}