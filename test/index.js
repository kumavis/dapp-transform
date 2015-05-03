var test = require('tape')
var fs = require('fs')
var from = require('from')
var iframeSandbox = require('iframe-sandbox')

var DappTransform = require('../index.js')


test('basic test', function(t){
  t.plan(1)

  var transform = DappTransform({
    origin: 'https://yummyy.am/toothpaste/',
  })

  setupTest('basic', transform, function(sandbox){
    sandbox.on('message', function(){
      t.ok(true, 'got message from sandbox')
    })
  })

})

test('can insert globals', function(t){
  t.plan(1)

  var transform = DappTransform({
    origin: 'https://yummyy.am/toothpaste/',
    shadowWindow: {
      assert: 'sandboxMessage',
    }
  })

  setupTest('globals', transform, function(sandbox){
    sandbox.on('message', function(){
      t.ok(true, 'got message from sandbox')
    })
  })

})

test('window and this', function(t){
  t.plan(6)

  var transform = DappTransform({
    origin: 'https://yummyy.am/toothpaste/',
  })

  autoTest('window-this', t, transform)

})

test('relative urls', function(t){
  t.plan(1)

  var transform = DappTransform({
    origin: 'https://yummyy.am/toothpaste/',
  })

  autoTest('relative-url', t, transform)

})

test('location', function(t){
  t.plan(5)

  var transform = DappTransform({
    origin: 'https://yummyy.am/toothpaste/',
  })

  autoTest('location-history', t, transform)

})

// util

function setupTest(testFileName, transform, cb) {
  iframeSandbox({
    container: document.body,
    src: 'http://frame.vapor.to/',
  }, function(err, sandbox){

    var inputStream = fetchTestStream(testFileName)
    var sandboxStream = sandbox.createWriteStream()
    
    inputStream
      .pipe(transform)
      .pipe(sandboxStream)

    cb(sandbox)

  })
}

function autoTest(testFileName, t, transform) {
  setupTest(testFileName, transform, function(sandbox){
    
    sandbox.on('message', function(tests){
      tests.forEach(function(data){
        t.ok(data.test, data.message)
      })
    })

  })
}

var testFiles = {
  'basic': fs.readFileSync(__dirname+'/basic.html'),
  'globals': fs.readFileSync(__dirname+'/globals.html'),
  'window-this': fs.readFileSync(__dirname+'/window-this.html'),
  'relative-url': fs.readFileSync(__dirname+'/relative-url.html'),
  'location-history': fs.readFileSync(__dirname+'/location-history.html'),
}

function fetchTestStream(name) {
  return from([testFiles[name]])
}