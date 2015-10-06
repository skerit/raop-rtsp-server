'use strict'

var util = require('util')
var stream = require('readable-stream')
var debug = require('./debug')

var SequenceStream = module.exports = function (session, opts) {
  if (!(this instanceof SequenceStream)) return new SequenceStream(session, opts)

  stream.Readable.call(this, opts)

  this._session = session
  this._firstSeq = null
  this._lastSeq = null
  this._flowing = false
  this._queue = []
  this._unorderd = []
  this._haveUnordered = false
}

util.inherits(SequenceStream, stream.Readable)

SequenceStream.prototype.add = function (seq, chunk) {
  var self = this

  if (this._firstSeq === null) {
    if (this._session.rtpInfo) {
      this._firstSeq = this._session.rtpInfo.seq
      debug('start-sequence detected: %d', this._firstSeq)
    } else {
      this._firstSeq = seq - 1
      debug('no start-sequence detected - defauling to %d', this._firstSeq)
    }
  } else {
    if (this._lastSeq >= seq) {
      debug('received chunk %d multiple times - ignoring', seq)
      return
    }

    if (this._lastSeq + 1 !== seq) {
      debug('received chunk %s out of order - queueing', seq)
      this._haveUnordered = true
      this._unorderd.push([seq, chunk])
      return
    }
  }

  this._push(chunk)
  this._lastSeq = seq

  if (this._haveUnordered) {
    this._unorderd = this._unorderd
      .sort(function (a, b) {
        return a[0] - b[0]
      })
      .filter(function (arr) {
        if (self._lastSeq + 1 !== arr[0]) return false
        self._push(arr[1])
        self._lastSeq = arr[0]
        return true
      })
    this._haveUnordered = this._unorderd.length > 0
  }
}

SequenceStream.prototype._push = function (chunk) {
  if (this._flowing) {
    var result = this.push(chunk)
    if (!result) {
      debug('back pressure detected!')
      this._flowing = false
    }
    return result
  } else {
    this._queue.push(chunk)
  }
}

SequenceStream.prototype._read = function () {
  if (!this._flowing) debug('entering flowing mode...')
  this._flowing = true
  if (this._queue.length === 0) return
  var chunk
  while ((chunk = this._queue.shift()) !== null) {
    if (!this._push(chunk)) return
  }
}
