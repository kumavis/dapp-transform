var url = require('url')
var extend = require('xtend')
var FakeSessionStorage = require('./globals/session-storage.js')
var FakeLocation = require('./globals/location.js')
var FakeHistory = require('./globals/history.js')
var FakeXMLHttpRequest = require('./globals/xhr.js')
// var requireEthereum = null//require('./globals/ethereum.js')

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
  localStorage: new FakeSessionStorage(),
  sessionStorage: new FakeSessionStorage(),
  history: new FakeHistory(origin, location),
  XMLHttpRequest: FakeXMLHttpRequest,
  // Array: window.Array,
  // Boolean: window.Boolean,
  // Date: window.Date,
  // Function: window.Function,
  // Math: window.Math,
  // Number: window.Number,
  // Object: window.Object,
  // RegExp: window.RegExp,
  // String: window.String,
  // Error: window.Error,
  // TypeError: window.TypeError,
  // parseInt: window.parseInt,
  // require: requireEthereum.bind(null, origin),
  // addEventListener: addEventListener,
  // removeEventListener: removeEventListener,
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
  cookie: '',
  // disabling anchor tag shim for Meteor -- required for Angular
  // createElement: createElement,
}

copyKeys(document, documentGlobal, documentGlobalOverrides)

//
// setup lookup fallbacks
//

// -- fallback stack --
// windowGlobal
// actual window

windowGlobal.__proto__ = { __proto__: window }
documentGlobal.__proto__ = { __proto__: document }


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
      // bind for functions
      if (typeof source[key] === 'function') {
        target[key] = source[key].bind(source)
      } else {
        // target[key] = source[key]
      }
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
// window overrides
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
    // wrap event object to shadow source
    var newEvent = { source: windowGlobal }
    newEvent.__proto__ = event
    listener.call(windowGlobal, newEvent)
  }, useCapture)
}

function fakeRemoveEventListener(type, listener, useCapture) {
  console.warn('vapor - removeEventListener called - not implemented')
}

// //
// // document overrides
// //

// // head, body

// Object.defineProperty(documentGlobal, 'head', {
//   get: function(){
//     return document.head
//   },
//   set: function(value){
//     document.head = value
//     return value
//   },
// })

// Object.defineProperty(documentGlobal, 'body', {
//   get: function(){
//     return document.body
//   },
//   set: function(value){
//     document.body = value
//     return value
//   },
// })
