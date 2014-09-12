var RtcDataStream = require('rtc-data-stream')
var Quickconnect = require('rtc-quickconnect')
var CrdtDoc = require('crdt').Doc
var LevelUp = require('levelup')
var LevelScuttlebutt = require('level-scuttlebutt')
var SubLevel = require('level-sublevel')
var Leveljs = require('level-js')
var Udid = require('udid')
var Async = require('async')

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
  Async.series([
    this._setupDb.bind(this),
    this._setupUniverse.bind(this),
    this._startServer.bind(this),
    this._startEngine.bind(this),
  ])
}

CastleCore.prototype._setupDb = function(callback) {
  var db = SubLevel(LevelUp('node-moo', { db: Leveljs }))
  var universeDb = db.sublevel('universe')
  this.db = universeDb
  LevelScuttlebutt(universeDb, Udid('node-moo'), function() {
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
    console.log('obj created:', arguments)
  })
  this.universe.on('row_update', function(obj) {
    console.log('obj updated:', arguments)
  })
  callback()
}

CastleCore.prototype._startServer = function(callback) {
  Quickconnect('http://rtc.io/switchboard',{ room: 'node-moo' })
    .createDataChannel('node-moo')
    .on('channel:opened:node-moo', this._onPeerJoin.bind(this))
  callback()
}

CastleCore.prototype._startEngine = function(callback) {
  this._runLoop()
  callback()
}

//
// Event Handling
//

CastleCore.prototype._onPeerJoin = function(peerId, channel) {
  console.log('peer joined:', peerId)
  var rtcStream = RtcDataStream(channel)
  var universeStream = this.universe.createStream()
  rtcStream.pipe(universeStream).pipe(rtcStream)
  this._registerPeer({
    id: peerId,
    incommingConnection: rtcStream,
    outgoingConnection: universeStream,
  })
}

//
// Methods
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

CastleCore.prototype._getAllRows = function() {
  var objectStore = this.universe.rows
  return Object.keys(objectStore).map(function(id) {
    return objectStore[id]
  })
}

CastleCore.prototype._runLoop = function() {
  var indexObject = this.universe.get('AppIndex')
  var update = indexObject && indexObject.get('update')
  if (update) {
    try {
      var fn = new Function(update)
      fn.apply(this)
    } catch (err) {
      console.error(err)
    }
  }

  setTimeout(this._runLoop.bind(this), 400)
}

