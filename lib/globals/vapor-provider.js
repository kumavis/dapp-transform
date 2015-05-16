var HttpProvider = require('web3/lib/web3/httpprovider.js')
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
  var _this = this
  var isSync = !cb
  var resolvedSync = true
  var result = undefined

  this.forwardPayload(payload)

  // TODO - this should be injected from Vapor dapp starts
  var exposedAccounts = ['0xa06ef3ed1ce41ade87f764de6ce8095c569d6d57']

  switch (payload.method) {
    
    case 'web3_sha3':
      var hash = ethUtils.sha3(payload.params[0]).toString('hex')
      return handleResult(null, wrapResponse(payload, hash))
    
    case 'eth_sendTransaction':
      return handleResult(null, wrapResponse(payload, ''))

    case 'eth_coinbase':
      var currentAddress = exposedAccounts[0]
      return handleResult(null, wrapResponse(payload, currentAddress))

    case 'eth_accounts':
      return handleResult(null, wrapResponse(payload, exposedAccounts))

    case 'eth_gasPrice':
      // TODO - this should be dynamically set somehow
      var gasPrice = '0x01'
      return handleResult(null, wrapResponse(payload, [gasPrice]))

    case 'eth_call':
      var params = payload.params[0]
      if (!params.from) {
        var currentAddress = exposedAccounts[0]
        params.from = currentAddress
      }
      return handleNormally()
    
    default:
      console.log('rpc method fallthrough:',payload.method)
      return handleNormally()
  }

  resolvedSync = false

  function handleNormally(){
    if (isSync) {
      return handleResult(null, _this.http.send(payload))
    } else {
      _this.http.sendAsync(payload, handleResult)
    }
  }

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
