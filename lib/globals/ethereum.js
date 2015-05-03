var ethereum = require('ethereum.js')
var VaporProvider = require('./vapor-provider.js')

module.exports = function(origin, target){
  if (target === 'ethereum.js' || 'web3.js') {
    return getEthereum(origin)
  } else {
    throw new Error('Vapor - we broke your require somehow. sorry.')
  }
}

function getEthereum(origin) {
  // global.sandboxMessage is provided by iframe-sandbox
  var rpcUrl = (origin.hostname === 'localhost') ? 'http://localhost:4000/' : 'https://vapor-rpc.herokuapp.com/'
  ethereum.setProvider(new VaporProvider(global.sandboxMessage, rpcUrl))
  ethereum.setProvider = function(){ console.log('ethereum.setProvider blocked.') }
  return ethereum
}