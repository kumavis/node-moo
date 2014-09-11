var rtcDataStream = require('rtc-data-stream')
var quickconnect = require('rtc-quickconnect')
var CrdtDoc = require('crdt').Doc
var LevelUp = require('levelup')
var LevelScuttlebutt = require('level-scuttlebutt')
var SubLevel = require('level-sublevel')
var leveljs = require('level-js')
var udid = require('udid')

module.exports = CastleCore


function CastleCore(opts) {
  this._initialize(opts)
}

CastleCore.create = function(opts) {
  return new CastleCore(opts)
}

CastleCore.prototype.createObject = function(opts) {
  this.universe.add(opts)
}

CastleCore.prototype._initialize = function(opts) {
  this.peers = {}
  this._setupDb(opts)
  this._startServer(opts)
}

CastleCore.prototype._setupDb = function(opts) {
  var db = SubLevel(LevelUp('node-moo', { db: leveljs }))
  var universeDb = db.sublevel('universe')
  this.db = universeDb
  LevelScuttlebutt(universeDb, udid('node-moo'), function(){
    return new CrdtDoc()
  })
  universeDb.open('myWorld', this._setupUniverse.bind(this))
}

CastleCore.prototype._setupUniverse = function(err, universe) {
  if (err) throw err
  console.log('universe ready')
  universe.on('create', function() {
    console.log('row created:', arguments)
  })
  universe.on('row_update', function() {
    console.log('row updated:', arguments)
  })
  this.universe = universe
}

CastleCore.prototype._startServer = function(opts) {
  quickconnect('http://rtc.io/switchboard',{ room: 'node-moo' })
    .createDataChannel('node-moo')
    .on('channel:opened:node-moo', this._onPeerJoin.bind(this))
}

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

CastleCore.prototype._registerPeer = function(peer) {
  this.peers[peer.id] = peer
  peer.outgoingConnection.on('error', function () {
    throw new Error('UniverseStreamError')
  })
  peer.incommingConnection.on('error', function () {
    peer.outgoingConnection.destroy()
  })
}
