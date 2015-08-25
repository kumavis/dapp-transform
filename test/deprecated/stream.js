var test = require('tape')
var eos = require('end-of-stream')
var from = require('from')
var DappTransform = require('../index.js')
process.stdout = process.stdout || browserout()

test(function(t){

  t.plan(1)

  var transform = DappTransform({
    origin: 'https://yummyy.am/toothpaste/',
  })

  var output = ''
  transform.on('data', function(data){
    output += data.toString()
  })

  transform.on('error', function(err){
    t.fail(err)
  })

  eos(transform, function(err){
    console.log('end', err, output)
    t.ok(output.length > 0)
  })

  var inStream = from([
    '<html>',
    '<head></head>',
    '</html>',
  ])
  
  inStream
  .pipe(transform)
  // .pipe(process.stdout)

})
  