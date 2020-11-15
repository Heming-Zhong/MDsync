var NodeRSA = require('node-rsa')
var fs = require('fs')

function generator() {
  var key = new NodeRSA({ b: 512 })
  key.setOptions({ encryptionScheme: 'pkcs1' })

  var privatePem = key.exportKey('pkcs1-private-pem')
  var publicPem = key.exportKey('pkcs1-public-pem')

  fs.writeFile('./public.pem', publicPem, (err) => {
    if (err) throw err
    console.log('公钥已保存！')
  })
  fs.writeFile('./private.pem', privatePem, (err) => {
    if (err) throw err
    console.log('私钥已保存！')
  })
}

generator();