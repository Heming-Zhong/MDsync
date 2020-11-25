var fs = require('fs');
const crypto = require('crypto');
const path = require('path');

var encrypt = function(toEncrypt, privateKey) {
    var retText;
    var privatekey = fs.readFileSync(privateKey);

    retText = crypto.publicEncrypt(privatekey, Buffer.from(toEncrypt));

    ret = retText.toString("base64");

    console.log(ret);
    return ret;
}

var decrypt = function(toDecrypt, publicKey) {
    var retText;
    var key = fs.readFileSync(publicKey)
    var buff = Buffer(toDecrypt, 'base64');
    retText = crypto.privateDecrypt(key, buff);
    return retText.toString();
}

//module.exports = encrypt
exports.encry = encrypt
exports.decry = decrypt