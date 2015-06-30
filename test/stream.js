var test = require('tape')
var eos = require('end-of-stream')
var from = require('from')
var DappTransform = require('../index.js')

test(function(t){

  t.plan(1)

  var transform = DappTransform({
    origin: 'https://yummyy.am/toothpaste/',
  })

  var output = ''
  transform.on('data', function(data){
    console.log('data')
    output += data.toString()
  })

  eos(transform, function(){
    console.log('end', output)
    t.ok(output.length > 0)
  })

  from([
    '<html>',
    '<head></head>',
    '</html>',
  ])
  .pipe(transform)

})
  