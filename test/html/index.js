// const h = require('hyperscript')
// const from = require('from')
// const concat = require('concat-stream')
const util = require('../../lib/util.js')

const targetUrl = 'http://happydapp.io/toothpaste/'
const relativeUrl = './relative_location'



module.exports = function(test){

  test('rewrites anchor tags', function(t){
    t.plan(2)

    t.equal(window.location.href, targetUrl, 'window.location.href is overwritten')

    var anchor = document.createElement('a')
    anchor.setAttribute('href', relativeUrl)

    var expectedUrl = util.transformUrlForLocalNav(relativeUrl)

    t.equal(anchor.href, expectedUrl, 'runtime-generated anchor tag is rebased')

  })

}

function htmlBody(content){
  return h('html', [
    h('head'),
    h('body', content),
  ])
}

// feeds src into the transform stream and returns the result
function performTransform(src, transform, cb){
  var fromStream = from([src])
  fromStream.on('end', function(){ fromStream.emit('finish') })
  streamToBuffer(transform, cb)
  fromStream.pipe(transform)
}

function streamToBuffer(stream, cb){
  stream.on('error', cb)
  var sink = concat(stream, function formatResult(result){
    cb(null, result.toString())
  })
  stream.pipe(sink)
}

function standardHtmlTest(opts, cb){
  var targetUrl = opts.targetUrl
  var environment = opts.environment
  var html = opts.html

  var transform = HtmlTransform({
    targetUrl: targetUrl,
    environment: environment,
  })

  performTransform(html, transform, function(err, result){
    if (err) return cb(err)
    document.open()
    document.write(result)
    document.close()
    cb(null, dom)
  })
}