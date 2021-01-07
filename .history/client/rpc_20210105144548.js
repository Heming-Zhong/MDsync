const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, 'mdsync.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

const proto = protoDescriptor.msg;

//module.exports = proto;

var trigger = function(ip, port) {
    var addr = ip + ':' + port;
    var client = new proto.serviceMDSync(addr, grpc.credentials.createInsecure());
    return client
}

var unique_id = "";
var cur_login_status = false;

exports.getstub = trigger
exports.uid = unique_id;
exports.status = cur_login_status;