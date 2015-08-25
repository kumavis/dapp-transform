var test = require('tape')
var from = require('from')
var streamToBuffer = require('stream-to-buffer')

var DappTransform = require('../index.js')


test('basic test', function(t){
  t.plan(1)

  var transform = DappTransform({
    origin: 'https://yummyy.am/toothpaste/',
  })

  var inStream = from(['<html><head></head><body></body></html>'])
  var outStream = inStream.pipe(transform)

  streamToBuffer(outStream, function(err, result){

    t.notOk(err, 'completed without error')

  })

})