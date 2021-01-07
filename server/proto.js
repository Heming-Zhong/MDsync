const path=require('path');
const grpc=require('@grpc/grpc-js');
const protoLoader=require('@grpc/proto-loader');

const PROTO_PATH=path.join(__dirname,'mdsync.proto');
const packageDefinition=protoLoader.loadSync(PROTO_PATH,
    {
        keepCase:true,
        longs:String,
        enums:String,
        defaults:true,
        oneofs:true
    });
const protoDescriptor=grpc.loadPackageDefinition(packageDefinition);

const proto=protoDescriptor.msg;

module.exports=proto;