var rtcDataStream = require('rtc-data-stream')
var quickconnect = require('rtc-quickconnect')

module.exports = CastleCore


function CastleCore(opts) {
  this._initialize(opts)
}

CastleCore.create = function(opts) {
  return new CastleCore(opts)
}

CastleCore.prototype._initialize = function(opts) {
  this.peers = {};
  this._startServer(opts)
}

CastleCore.prototype._startServer = function(opts) {
  quickconnect('http://rtc.io/switchboard',{ room: 'node-moo' })
    .createDataChannel('node-moo')
    .on('channel:opened:node-moo', this._onPeerJoin.bind(this))
}

CastleCore.prototype._onPeerJoin = function(peerId, channel) {
  var rtc = rtcDataStream(channel)
  this.peers[peerId] = rtc
  console.log('peer joined:', peerId)
}