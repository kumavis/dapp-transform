var ethereum = require('web3')
var VaporProvider = require('./vapor-provider.js')

module.exports = getEthereum

function getEthereum(origin) {
  // global.sandboxMessage is provided by iframe-sandbox
  var rpcUrl = (origin.hostname === 'localhost') ? 'http://localhost:4000/' : 'https://rpc.vapor.to/'
  ethereum.setProvider(new VaporProvider(global.sandboxMessage, rpcUrl))
  ethereum.setProvider = function(){ console.log('ethereum.setProvider blocked.') }
  return ethereum
}