const grpc=require('@grpc/grpc-js');
const proto=require('./proto');
const impl=require('./grpc_implement');
const fs=require("fs-extra");
const path=require('path');

var logSys=require('./log_sys');

function main()
{
    /* init dir/files */
    fs.ensureDirSync(path.join(__dirname,"runtime"));
    fs.ensureDirSync(path.join(__dirname,"runtime/file"));
    if (!fs.existsSync(path.join(__dirname,"runtime/conf.json")))
    {

        fs.copyFileSync(path.join(__dirname,"conf.json.example"),path.join(__dirname,"runtime/conf.json"));
    }

    /* read the config file */
    var config=require('./runtime/conf.json');
    if (config.server.host=='undefined')
    {
        logSys.writeLog('config','error','conf.json is incomplete');
        return 1;
    }
    else global.serverHost=config.server.host;
    if (config.server.port=='undefined')
    {
        logSys.writeLog('config','error','conf.json is incomplete');
        return 1;
    }
    else global.serverPort=config.server.port;

    /* read db */
    if (!fs.existsSync(path.join(__dirname,"runtime/MDSync.db")))
    {
        const mainDB=require("better-sqlite3")("runtime/MDSync.db");
        mainDB.prepare("create table user (name varchar(20),passwd varchar(50),primary key(name))").run();
        mainDB.prepare("create table property (name varchar(20),value varchar(50),primary key(name))").run();
        mainDB.prepare("insert into property values('timestamp','0')").run();
    }
    else
    {
        const mainDB=require("better-sqlite3")("runtime/MDSync.db");
        var query=mainDB.prepare("select value from property where name='timestamp'");
        var result=query.get().values;
        result=parseInt(result);
        impl.setServerTime(result);
    }


    /* start gRPC server */
    var server=new grpc.Server();
    server.addService(proto.serviceMDSync.service,
        {
            login:impl.login,
            getDirInfo:impl.getDirInfo,
            getFileInfo:impl.getFileInfo,
            fileOperation:impl.fileOperation,
            uploadReq:impl.uploadReq,
            downloadReq:impl.downloadReq,
            newFileReq:impl.newFileReq,
            getFileTree:impl.getFileTree,
            getTimeStamp:impl.getTimeStamp
        });
    server.bindAsync(
        config.server.host+':'+config.server.port,
        grpc.ServerCredentials.createInsecure(),
        () =>
        {
            server.start()
            logSys.writeLog('server','notify','grpc server started on '+config.server.host+':'+config.server.port);
        });
    
    /* other works */
    setInterval(impl.TTLControl,30000);
};

main();