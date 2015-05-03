module.exports = FakeSessionStorage

function FakeSessionStorage() {
  var store = {}
  this._store = store
  // overwriting proto allows lookups on localStorage obj, e.g.: localStorage[key]
  var proto = Object.create(store)
  proto.setItem = setItem
  proto.getItem = getItem
  proto.removeItem = removeItem
  this.__proto__ = proto
}

function setItem(key, value) {
  this._store[key] = value
  return value
}

function getItem(key) {
  var value = this._store[key]
  return value
}

function removeItem(key) {
  delete this._store[key]
}