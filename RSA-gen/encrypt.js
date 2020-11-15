var rsa=require('node-rsa');
var fs=require('fs');

function encrypt(toEncrypt,coding,privateKey)
{
    var retText;
    fs.readFile(
        privateKey,
        function(err,data)
        {
            var key=new rsa(data);
            retText=key.encryptPrivate(toEncrypt,coding);
        }
    );
    return retText;
}

function decrypt(toDecrypt,coding,publicKey)
{
    var retText;
    fs.readFile(
        publicKey,
        function(err,data)
        {
            var key=new rsa(data);
            retText=key.decryptPublic(toDecrypt,coding);
        }
    );
    return retText;
}