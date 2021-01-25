const grpc = require('@grpc/grpc-js');
const proto = require('./proto');

var trigger = function(ip, port) {
    var addr = ip + ':' + port;
    // console.log(proto)
    var client = new proto.serviceMDSync(addr, grpc.credentials.createInsecure());
    return client
}



exports.getstub = trigger