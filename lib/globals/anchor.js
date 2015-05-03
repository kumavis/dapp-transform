var url = require('url')

module.exports = FakeAnchorElement


function FakeAnchorElement(origin, tagName) {
  this._origin = origin
  this.setAttribute('href', origin.href)
}
FakeAnchorElement.prototype.setAttribute = function(key, val) {
  if (key === "href") {
    var newPath = url.parse(this._origin.resolve(val))
    this.href = newPath.href
    this.protocol = (newPath.protocol ? newPath.protocol.replace(/:$/, '') : '')
    this.host = newPath.host
    this.search = (newPath.search ? newPath.search.replace(/^\?/, '') : '')
    this.hash = (newPath.hash ? newPath.hash.replace(/^#/, '') : '')
    this.hostname = newPath.hostname
    this.port = newPath.port
    this.pathname = newPath.pathname
  } else {
    throw new Error('NotImplemented')
  }
}