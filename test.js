const fs = require('fs')
const DappTransform = require('./index.js')

// transform
var dappTransform = DappTransform({ origin: 'https://yummyy.am/toothpaste/' })

fs.createReadStream('./test/remote-js.html')
.pipe(dappTransform)
.pipe(process.stdout)
