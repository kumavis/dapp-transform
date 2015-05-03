var HttpProvider = require('ethereum.js/lib/web3/httpprovider.js')
var ethUtils = require('ethereumjs-util')

module.exports = VaporProvider


function VaporProvider(forwardPayload, host) {
  this.handlers = []
  this.forwardPayload = forwardPayload
  this.http = new HttpProvider(host)
}

VaporProvider.prototype.send = function (payload) {
  return this.handlePayload(payload)
}

VaporProvider.prototype.sendAsync = function (payload, cb) {
  this.handlePayload(payload, cb)
}

VaporProvider.prototype.handlePayload = function (payload, cb) {
  var isSync = !cb
  var resolvedSync = true
  var result = undefined

  this.forwardPayload(payload)

  switch (payload.method) {
    
    case 'web3_sha3':
      var hash = ethUtils.sha3(payload.params[0]).toString('hex')
      return handleResult(null, wrapResponse(payload, hash))
    
    case 'eth_sendTransaction':
      return handleResult(null, wrapResponse(payload, ''))

    case 'eth_coinbase':
      // TODO - this should be injected from Vapor dapp starts
      var currentAddress = '0xa06ef3ed1ce41ade87f764de6ce8095c569d6d57'
      return handleResult(null, wrapResponse(payload, currentAddress))

    case 'eth_accounts':
      // TODO - this should be injected from Vapor dapp starts
      var currentAddress = '0xa06ef3ed1ce41ade87f764de6ce8095c569d6d57' 
      return handleResult(null, wrapResponse(payload, [currentAddress]))
    
    default:
      console.log('rpc method fallthrough:',payload.method)
      if (isSync) {
        return handleResult(null, this.http.send(payload))
      } else {
        this.http.sendAsync(payload, handleResult)
      }
  }

  resolvedSync = false

  // helper for normalizing handling of sync+async responses
  function handleResult(err, resp) {
    if (isSync) {
      return resp
    } else {
      if (resolvedSync) {
        process.nextTick(cb(err, resp))
      } else {
        cb(err, resp)
      }
    }
  }
}

function wrapResponse(payload, result){
  return {
    jsonrpc: payload.jsonrpc,
    id: payload.id,
    result: result,
  }
}
