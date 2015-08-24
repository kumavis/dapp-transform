const async = require('async')
const express = require('express')
const request = require('request')
const HtmlTransform = require('./index.js').HtmlTransform
const JsTransform = require('./index.js').JsTransform
const CssTransform = require('./index.js').CssTransform
const generateEnvironment = require('./index.js').generateEnvironment
const PORT = process.env.PORT || 9000


var envOpts = {}

async.waterfall([
  generateEnvironment.bind(null, envOpts),
  startServer,
], function(err){
  if (err) throw err
  console.log('Dapp transform listening on', PORT)
})


function startServer(environment, cb){
  var app = express()

  // transform html
  app.get('/html/:target', function(req, res) {
    var targetUrl = req.params.target
    console.log('html:', targetUrl)
    var transform = HtmlTransform({
      targetUrl: targetUrl,
      environment: environment,
    })
    performTransform('html', targetUrl, transform, res)
  })

  // transform js
  app.get('/js/:target', function(req, res) {
    var targetUrl = req.params.target
    console.log('js:', targetUrl)
    var transform = JsTransform({
      targetUrl: targetUrl,
      environment: environment,
    })
    performTransform('js', targetUrl, transform, res)
  })

  // transform css
  app.get('/css/:target', function(req, res) {
    var targetUrl = req.params.target
    console.log('css:', targetUrl)
    var transform = CssTransform({
      targetUrl: targetUrl,
      environment: environment,
    })
    performTransform('css', targetUrl, transform, res)
  })

  // static assets
  app.get('/static/init.js', function(req, res) {
    res.send(environment.init)
  })

  app.listen(PORT, cb)
}

// request target, perform tranform, respond
// handles errors during this process
function performTransform(label, url, transformStream, res){
  var didAbort = false
  
  try {
    // request
    var req = request({ url: url })
  } catch (err) {
    return onError(err)
  }

  req.on('error', onError)

  // log on start
  req.once('data', function(err) {
    if (didAbort) return
    console.log('transforming '+label+' => ' + url)
  })
  
  // request then transform then respond
  req
  .pipe(transformStream)
  .pipe(res)

  function onError(err){
    console.error('BAD '+label+':', url, err)
  }
}
