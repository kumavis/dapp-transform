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
  body: SKIP,
  head: SKIP,
  location: SKIP,
  domain: origin.hostname,
  nodeType: document.nodeType,
  cookie: '',
}

copyKeys(document, documentGlobal, documentGlobalOverrides)

Object.defineProperty(documentGlobal, 'documentElement', {
  get: function(){ return document.documentElement },
  set: function(value){ return document.documentElement = value },
})

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
      value = overrides[key]
      if (value === SKIP) continue
      target[key] = value
    } else {
      // accessing properties can trigger security-related DOMExceptions
      // so we wrap in a try-catch
      try {
        // append any functions, bound to original source
        if (typeof source[key] === 'function') {
          target[key] = source[key].bind(source)
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

// document.head, document.body

Object.defineProperty(documentGlobal, 'head', {
  get: function(){
    return document.head
  },
})

Object.defineProperty(documentGlobal, 'body', {
  get: function(){
    return document.body
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
