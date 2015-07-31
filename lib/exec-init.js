var url = require('url')
var extend = require('xtend')
var FakeSessionStorage = require('./globals/session-storage.js')
var FakeLocation = require('./globals/location.js')
var FakeHistory = require('./globals/history.js')
var FakeXMLHttpRequest = require('./globals/xhr.js')
var ethereum = require('./globals/ethereum.js')

//
// inject environment variables
//

PROXY_URL = "INSERT PROXY_URL HERE"
RPC_URL = "INSERT RPC_URL HERE"

//
// setup global objects
//

// parse origin
var originHref = "INSERT ORIGIN HERE"
var origin = url.parse(originHref)

// bind classes to origin
var location = new FakeLocation(originHref)
FakeXMLHttpRequest = FakeXMLHttpRequest.bind(null, origin)

// create globals
var windowGlobal = {}
var documentGlobal = {}

// store globals on document
document.__runtimeContext__ = {
  originalWindow: window,
  originalDocument: document,
  windowGlobal: windowGlobal,
  documentGlobal: documentGlobal,
  originHref: originHref,
  origin: origin,
}

//
// copy all properties
//

var SKIP = {}

//
// window
//

var windowGlobalOverrides = {
  window: windowGlobal,
  document: documentGlobal,
  top: windowGlobal,
  localStorage: SKIP,
  sessionStorage: SKIP,
  location: SKIP,
  history: SKIP,
  frameElement: null,
  setTimeout: fakeSetTimeout,
  setInterval: fakeSetInterval,
  addEventListener: fakeAddEventListener,
  removeEventListener: fakeRemoveEventListener,
}

var windowGlobalExtras = {
  web3: ethereum(origin),
  localStorage: new FakeSessionStorage(),
  sessionStorage: new FakeSessionStorage(),
  history: new FakeHistory(origin, location),
  XMLHttpRequest: FakeXMLHttpRequest,
}

var externalWindowGlobalExtras = {/* INSERT EXTERNAL WINDOW GLOBALS HERE */}

windowGlobalExtras = extend(windowGlobalExtras, externalWindowGlobalExtras)

copyKeys(window, windowGlobal, windowGlobalOverrides, windowGlobalExtras)

//
// document
//

var documentGlobalOverrides = {
  location: SKIP,
  cookie: '',
}

copyKeys(document, documentGlobal, documentGlobalOverrides)

//
// setup lookup fallbacks
//

// -- fallback stack --
// windowGlobal
// actual window

windowGlobal.__proto__ = window
documentGlobal.__proto__ = document


//
// ==================== util ===============
//

// copies all properties from source to target
// binds functions to source
// also adds extras

function copyKeys(source, target, overrides, extras) {
  // 1) properties on source
  for (var key in source) {
    var value
    if (overrides && key in overrides) {
      // set value from override
      value = overrides[key]
      if (value === SKIP) continue
      target[key] = value
    } else {
      // use value on original object
      // accessing properties can trigger security-related DOMExceptions
      // so we wrap in a try-catch
      try {
        if (typeof source[key] === 'function') {
          // bind functions
          target[key] = source[key].bind(source)
        } else {
          // setup setter/getters for correct fallback (avoid illegal invocation error)
          Object.defineProperty(target, key, {
            get: function(source, key){ return source[key] }.bind(null, source, key),
            set: function(source, key, value){ return source[key] = value }.bind(null, source, key),
          })
        }
      } catch (_) {}
    }
  }
  // 2) extras
  if (!extras) return
  for (var key in extras) {
    var value = extras[key]
    target[key] = value
  }
}

//
// additional overrides
//

// location, history

Object.defineProperty(windowGlobal, 'location', {
  get: function(){
    return location
  },
  set: function(value){
    location.replace(value)
    return value
  },
})

Object.defineProperty(documentGlobal, 'location', {
  get: function(){
    return location
  },
  set: function(value){
    location.replace(value)
    return value
  },
})

// setTimeout, setInterval

function fakeSetTimeout(cb, time) {
  return window.setTimeout(cb.bind(windowGlobal), time)
}

function fakeSetInterval(cb, time) {
  return window.setInterval(cb.bind(windowGlobal), time)
}

// add event listener

function fakeAddEventListener(type, listener, useCapture) {
  window.addEventListener(type, function(event){
    var newEvent = event
    if (event.source === window) {
      // wrap event object to shadow source
      var newEvent = { source: windowGlobal }
      newEvent.__proto__ = event
    }
    listener.call(windowGlobal, newEvent)
  }, useCapture)
}

function fakeRemoveEventListener(type, listener, useCapture) {
  console.warn('vapor - removeEventListener called - not implemented')
}
