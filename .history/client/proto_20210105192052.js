const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = path.join(__dirname, 'mdsync.proto');
// console.log(PROTO_PATH)
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
console.log(packageDefinition)
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
console.log(protoDescriptor)

const proto = protoDescriptor.msg;

console.log(proto)
module.exports = proto;