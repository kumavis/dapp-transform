const DappTransform = require('./index.js')
const express = require('express')
const request = require('request')
const PORT = process.env.PORT || 9000

var app = express()

// transform dapp
app.get('/:target', function(req, res) {
  var url = req.params.target
  
  fetchDapp()

  function fetchDapp(err, result){
    var didAbort = false
    
    try {
      // request
      var dappReq = request({
        url: url,
        followRedirect: false,
      })
    } catch (err) {
      return onError(err)
    }

    dappReq.on('error', onError)

    // transform
    var dappTransform = DappTransform({ origin: url })

    // log on start
    dappReq.once('data', function(err) {
      if (didAbort) return
      console.log('transforming => ' + url)
    })
    
    // request then transform then respond
    dappReq.pipe(dappTransform).pipe(res)

    function onError(err){
      console.error('BAD DAPP:', url, err)
    }
  }

})

app.listen(PORT)
console.log('Vapor Dapp transform listening on', PORT)
