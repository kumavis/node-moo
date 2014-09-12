var Async = require('async')
var RtcDataStream = require('rtc-data-stream')
var Quickconnect = require('rtc-quickconnect')
var CrdtDoc = require('crdt').Doc
var TreeString = require('treeify').asTree

module.exports = Telescope


function Telescope(opts) {
  this._initialize(opts)
}

Telescope.create = function(opts) {
  return new Telescope(opts)
}

//
// Public
//

Telescope.prototype.createObject = function(opts) {
  this.universe.add(opts)
}

//
// Initialization
//

Telescope.prototype._initialize = function(opts) {
  this.opts = opts
  this.peers = {}
  Async.series([
    this._setupUniverse.bind(this),
    this._startNetworkAdapter.bind(this),
  ])
}
Telescope.prototype._setupUniverse = function(callback) {
  this.universe = new CrdtDoc()
  this.universe.on('create', this._onNewObject.bind(this))
  this.universe.on('row_update', this._onUpdateObject.bind(this))
  this.universe.on('remove', this._onDeleteObject.bind(this))
  console.log('universe ready')
  callback()
}

Telescope.prototype._startNetworkAdapter = function(callback) {
  Quickconnect('http://rtc.io/switchboard',{ room: 'node-moo' })
    .createDataChannel('node-moo')
    .on('channel:opened:node-moo', this._onPeerJoin.bind(this))
  callback()
}

//
// Event Handling
//

Telescope.prototype._onPeerJoin = function(peerId, channel) {
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

Telescope.prototype._onNewObject = function(obj) {
  this.createObjectView(obj)
}

Telescope.prototype._onUpdateObject = function(obj) {
  this.updateObjectView(obj)
}

Telescope.prototype._onDeleteObject = function(obj) {
  this.removeObjectView(obj)
}

//
// Methods
//

Telescope.prototype._registerPeer = function(peer) {
  this.peers[peer.id] = peer
  peer.outgoingConnection.on('error', function () {
    throw new Error('UniverseStreamError')
  })
  peer.incommingConnection.on('error', function () {
    peer.outgoingConnection.destroy()
  })
}

Telescope.prototype._deleteObject = function(obj) {
  this.universe.rm(obj.id)
}

//
// Temp View Code
//

Telescope.prototype.createObjectView = function(obj) {
  // container
  var container = document.createElement('div')
  container.id = '#obj-'+obj.id
  // text
  var text = document.createElement('pre')
  container.appendChild(text)
  // delete
  var button = document.createElement('button')
  button.textContent = 'delete'
  button.addEventListener('click',this._deleteObject.bind(this, obj))
  container.appendChild(button)
  // append to DOM
  document.body.appendChild(container)
}

Telescope.prototype.updateObjectView = function(obj) {
  var element = document.getElementById('#obj-'+obj.id).children[0]
  if (!element) return
  element.textContent = TreeString(obj.toJSON(), true)
}

Telescope.prototype.removeObjectView = function(obj) {
  var element = document.getElementById('#obj-'+obj.id).children[0]
  if (!element) return
  element.remove()
}