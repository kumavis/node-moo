var iframe = require('iframe')

module.exports = Castle


function Castle(opts) {
  this._initialize(opts)
}

Castle.create = function(opts) {
  return new Castle(opts)
}

Castle.prototype._initialize = function(opts) {
  // create iframe for core
  var iframe = document.createElement('iframe')
  iframe.src = './castle-core.html'
  document.head.appendChild(iframe)
  this.container = iframe
}