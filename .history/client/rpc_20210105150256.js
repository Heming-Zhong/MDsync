const grpc = require('@grpc/grpc-js');
const proto = require('./proto');

var trigger = function(ip, port) {
    var addr = ip + ':' + port;
    var client = new proto.serviceMDSync(addr, grpc.credentials.createInsecure());
    return client
}

var unique_id = "";
var cur_login_status = false;

trigger("127.0.0.1", "2020")

exports.getstub = trigger
exports.uid = unique_id;
exports.status = cur_login_status;