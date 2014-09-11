var rtcDataStream = require('rtc-data-stream')
var quickconnect = require('rtc-quickconnect')
var CrdtDoc = require('crdt').Doc
var LevelUp = require('levelup')
var LevelScuttlebutt = require('level-scuttlebutt')
var SubLevel = require('level-sublevel')
var leveljs = require('level-js')
var udid = require('udid')
var async = require('async')

module.exports = CastleCore


function CastleCore(opts) {
  this._initialize(opts)
}

CastleCore.create = function(opts) {
  return new CastleCore(opts)
}

//
// Public
//

CastleCore.prototype.createObject = function(opts) {
  this.universe.add(opts)
}

//
// Initialization
//

CastleCore.prototype._initialize = function(opts) {
  this.opts = opts
  this.peers = {}
  async.series([
    this._setupDb.bind(this),
    this._setupUniverse.bind(this),
    this._startServer.bind(this),
  ])
}

CastleCore.prototype._setupDb = function(callback) {
  var db = SubLevel(LevelUp('node-moo', { db: leveljs }))
  var universeDb = db.sublevel('universe')
  this.db = universeDb
  LevelScuttlebutt(universeDb, udid('node-moo'), function() {
    return new CrdtDoc()
  })
  universeDb.open('myWorld', function(err, universe){
    this.universe = universe
    callback(err)
  }.bind(this))
}

CastleCore.prototype._setupUniverse = function(callback) {
  console.log('universe ready')
  this.universe.on('create', function() {
    console.log('row created:', arguments)
  })
  this.universe.on('row_update', function() {
    console.log('row updated:', arguments)
  })
  callback()
}

CastleCore.prototype._startServer = function(callback) {
  quickconnect('http://rtc.io/switchboard',{ room: 'node-moo' })
    .createDataChannel('node-moo')
    .on('channel:opened:node-moo', this._onPeerJoin.bind(this))
  callback()
}

//
// Event Handling
//

CastleCore.prototype._onPeerJoin = function(peerId, channel) {
  console.log('peer joined:', peerId)
  var rtcStream = rtcDataStream(channel)
  var universeStream = this.universe.createStream()
  rtcStream.pipe(universeStream).pipe(rtcStream)
  this._registerPeer({
    id: peerId,
    incommingConnection: rtcStream,
    outgoingConnection: universeStream,
  })
}

//
// Helpers
//

CastleCore.prototype._registerPeer = function(peer) {
  this.peers[peer.id] = peer
  peer.outgoingConnection.on('error', function () {
    throw new Error('UniverseStreamError')
  })
  peer.incommingConnection.on('error', function () {
    peer.outgoingConnection.destroy()
  })
}
