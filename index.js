'use strict'

var rtsp = require('rtsp-server')
var mdns = require('raop-mdns-server')
var rtspMethods = require('./lib/rtsp-methods')
var sessions = require('./lib/sessions')
var debug = require('./lib/debug')
var pkg = require('./package')

var stdout = process.argv[2] === '--stdout'
var serverAgent = 'AirTunes/105.1'

sessions.on('new', function (session) {
  if (stdout) session.pipe(process.stdout)
  else session.resume()
})

var server = rtsp.createServer(function (req, res) {
  res.setHeader('Server', serverAgent)

  if (!~rtspMethods.METHODS.indexOf(req.method)) {
    res.statusCode = 501 // Not Implemented
    res.end()
    return
  }

  rtspMethods[req.method.toLowerCase()](req, res)
})

server.listen(5000, function () {
  var port = server.address().port
  debug('RAOP RTSP server listening on port %d', port)

  var txt = {
    txtvers: '1',
    ch: '2',
    cn: '0,1',
    ek: '1',
    et: '0,1',
    sv: 'false',
    da: 'true',
    sr: '44100',
    ss: '16',
    pw: 'false',
    vn: '65537',
    tp: 'TCP,UDP',
    vs: '105.1',
    am: 'AirPort4,107',
    fv: '76400.10',
    sf: '0x0'
  }

  mdns({ name: pkg.name, port: port, txt: txt }, function (err, result) {
    if (err) throw err
    global._raopMacAddr = result.mac
  })
})
