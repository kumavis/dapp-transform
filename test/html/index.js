// const h = require('hyperscript')
// const from = require('from')
// const concat = require('concat-stream')
// const HtmlTransform = require('../../index.js').HtmlTransform

const targetUrl = 'http://happydapp.io/toothpaste/'


module.exports = function(test){

  test('rewrites anchor tags', function(t){
    t.plan(2)

    t.equal(window.location.href, targetUrl, 'window.location.href is overwritten')
    t.ok(false)

    // var anchor = h('a', { href: './relative_location' })
    // var html = htmlBody(anchor).outerHTML

    // standardHtmlTest({
    //   targetUrl: targetUrl,
    //   environment: environment,
    //   html: html,
    // }, function(err, dom){
    //   if (err) return t.end(err)
      
    //   var href = dom('a').eq(0).attr('href')
    //   t.equal(href, 'https://transform.metamask.io/html/http%3A%2F%2Fhappydapp.io%2Ftoothpaste%2Frelative_location',
    //     'anchor tag href correctly rewritten')
    // })

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