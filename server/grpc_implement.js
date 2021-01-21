/* global data */
var userMap=new Map();
var auth=require('./user_auth');
var fsDB=require('./fs_database');

const chalk=require('chalk');


/* helper function */
const { v4:uuidv4 } = require('uuid');
function TTLControl()
{
    console.log(chalk.blueBright('[server] TTL Control Started'));
    userMap.forEach(function(value,key)
    {
        value.TTL-=1;
        if (value.TTL<=0) userMap.delete(key);
    });
}
function getServerTime()
{
    const mainDB=require("better-sqlite3")("runtime/MDSync.db");
    var cur=mainDB.prepare("select value from property where name='timestamp'").get();
    return parseInt(cur);
}
function moveServerTime()
{
    var time=getServerTime()+1;
    const mainDB=require("better-sqlite3")("runtime/MDSync.db");
    mainDB.prepare("update property set value=? where name='timestamp'").run(time.toString());
}
function setServerTime(time)
{
    const mainDB=require("better-sqlite3")("runtime/MDSync.db");
    mainDB.prepare("update property set value=? where name='timestamp'").run(time.toString());
}

exports.TTLControl=TTLControl;
exports.getServerTime=getServerTime;
exports.moveServerTime=moveServerTime;
exports.setServerTime=setServerTime;


/* gRPC service functions */
var login=function(call,callback)
{
    var loginInfo=call.request;
    chalk.blueBright('[server] user '+loginInfo.name+' try to login');
    var ret;
    var result=auth.auth(loginInfo.name,loginInfo.passwd);
    if (result)
    {
        ret={
            status:1,
            uuid:uuidv4()
        }
        userMap.set(ret.uuid,{ username:loginInfo.name,TTL:30 });
    }
    else
    {
        ret={
            status:1,
            uuid:'unavailable'
        }
    }
    callback(null,ret);
};
var getDirInfo=function(call)
{
    var req=call.request;
    var ret={
        status:1,
        type:other,
        name:null,
        date:null,
        size:null,
        md5:null
    }
    if (req.op!="getDirInfo")     //wrong operation
    {
        call.write(ret);
        call.end();
        return;
    }
    if (!userMap.has(req.uuid)) //no such uuid
    {
        ret.status=2;
        call.write(ret);
        call.end();
        return;
    }
    let user=userMap.get(req.uuid).username;
    var dirArr=fsDB.parsePath(user,req.address);
    if (dirArr==fsDB.wrongPath)
    {
        ret.status=3;           //wrong path
        call.write(ret);
        call.end();
        return;
    }

    ret.status=0;
    dirArr.forEach(element =>
        {
            ret.type=element.type;
            ret.name=element.name;
            call.write(ret);
        })
    call.end();
}
var getFileInfo=function(call,callback)
{

    var req=call.request;
    var ret={
        status:1,
        type:other,
        name:null,
        date:null,
        size:null,
        md5:null
    }
    if (req.op!="getFileInfo")     //wrong operation
    {
        callback(null,ret);
        return;
    }
    if (!userMap.has(req.uuid)) //no such uuid
    {
        ret.status=2;
        callback(null,ret);
        return;
    }
    let user=userMap.get(req.uuid).username;
    var fileAttr=fsDB.parseFile(user,req.address);
    if (fileAttr==fsDB.wrongPath)
    {
        ret.status=3;
        callback(null,ret);
        return;
    }
    ret.status=0;
    ret.type=fileAttr.type;
    ret.name=fileAttr.name;


    var fs=require('fs');
    var stats=fs.statSync(__dirname+'/runtime/files/'+user+req.address);
    ret.size=stats.size;

    var crypto=require('crypto');
    var buffer=fs.readFileSync(__dirname+'/runtime/files/'+user+req.address);
    var fsHash=crypto.createHash('md5');
    fsHash.update(buffer);
    ret.md5=fsHash.digest('hex');

    callback(null,ret);
    return;
};
var fileOperation=function(call,callback)
{
    var req=call.request;
    var ret={
        status:0,
        uuid:req.uuid
    };
    if (!userMap.has(req.uuid)) //no such uuid
    {
        ret.status=2;
        callback(null,ret);
        return;
    }

    var fs=require('fs-extra');
    var user=userMap.get(req.uuid).username;
    var fileAttr=fsDB.parseFile(user,req.address);
    var filePath=__dirname+'/runtime/files/'+user+req.address;
    

    switch (req.op)
    {
    case 'rm':
        //1. cheak addr
        if (fileAttr==fsDB.wrongPath)
        {
            ret.status=3;
            break;
        }
        //2. rm file
        fs.unlinkSync(filePath);
        //3. rm db
        if (req.address.substr(req.address.length-3,2)=="md")
        {
            fsDB.deleteNode(user,req.address,"markdown");
        }
        else fsDB.deleteNode(user,req.address,"other");
        global.serverTime+=1;
        break;
    case 'rmdir':
        //1. cheak addr
        if (fileAttr==fsDB.wrongPath)
        {
            ret.status=3;
            break;
        }
        //2. rm dir
        fs.removeSync(filePath);
        //3. rm db
        fsDB.deleteNode(user,req.address,"directory");
        break;
    case 'mkdir':
        //1. cheak addr
        if (fileAttr!=fsDB.wrongPath)
        {
            ret.status=3;
            break;
        }
        //2. fs op
        fs.mkdirSync(filePath);
        //3. DB op
        fsDB.addNode(user,{
            type:"directory",
            path:req.address,
            timestamp:global.serverTime
        })
        break;
    case 'mv':
        //1. cheak addr
        if (fileAttr==fsDB.wrongPath)
        {
            ret.status=3;
            break;
        }
        //2. fs op
        fs.moveSync(filePath,__dirname+'/runtime/files/'+user+req.extra);
        //3. DB op
        if (req.address.substr(req.address.length-3,2)=="md")
        {
            fsDB.moveNode(user,req.address,"markdown",req.extra);
        }
        else fsDB.moveNode(user,req.address,"other",req.extra,global.serverTime);
        
        break;
    case 'mvdir':
        //1. cheak addr
        if (fileAttr==fsDB.wrongPath)
        {
            ret.status=3;
            break;
        }
        //2. fs op
        fs.moveSync(filePath,__dirname+'/runtime/files/'+user+req.extra);
        //3. DB op
        fsDB.moveNode(user,req.address,"directory",req.extra,global.serverTime);
        break;
    case 'rename':
        //1. cheak addr
        if (fileAttr==fsDB.wrongPath)
        {
            ret.status=3;
            break;
        }
        //2. fs op
        var newPath=fsDB.splitAddr(req.address).dirname+"/"+req.extra;
        fs.renameSync(filePath,__dirname+'/runtime/files/'+user+newPath);
        //3. DB op
        fsDB.moveNode(user,req.address,"directory",newPath,global.serverTime);
        break;
    default:
        ret.status=1;//wrong operation
    }

    callback(null,ret);
    return;
}
var uploadReq=function(call,callback)
{
    var req=call.request;
    var ret={
        status:0,
        ip:'',
        port:''
    };
    if (!userMap.has(req.uuid)) //no such uuid
    {
        ret.status=2;
        callback(null,ret);
        return;
    }


    var fs=require('fs-extra');
    var user=userMap.get(req.uuid).username;
    var filePath=__dirname+'/runtime/files/'+user+req.address;
    var net=require('net');
    var server=net.createServer(function(connection)
    {
        console.log('TCP Connect in');
        connection.on('end', function() {
            moveServerTime();
            fsDB.moveNode(user,req.address,req.address);
            console.log('File Transfer Done');
        });
        connection.on('data',function(data){
            fs.writeFile(filePath,data);
        })
    });

    //TCP服务器开始端口监听
    server.listen(0,function()
    {
        ret.ip=global.serverHost;
        ret.port=server.address().port;
        callback(null,ret);
    });

}
var downloadReq=function(call,callback)
{
    var req=call.request;
    var ret={
        status:0,
        ip:'',
        port:''
    };
    if (!userMap.has(req.uuid)) //no such uuid
    {
        ret.status=2;
        callback(null,ret);
        return;
    }


    var fs=require('fs-extra');
    var user=userMap.get(req.uuid).username;
    var filePath=__dirname+'/runtime/files/'+user+req.address;
    var net=require('net');
    var server=net.createServer(function(connection)
    {
        console.log('TCP Connect in');
        connection.on('end', function() {
            console.log('File Transfer Done');
        });
        var data=fs.readFileSync(filePath);
        connection.write(data);
        connection.end();
    });

    //TCP服务器开始端口监听
    server.listen(0,function()
    {
        ret.ip=global.serverHost;
        ret.port=server.address().port;
        callback(null,ret);
    });
}
var newFileReq=function(call,callback)
{
    var req=call.request;
    var ret={
        status:0,
        ip:'',
        port:''
    };
    if (!userMap.has(req.uuid)) //no such uuid
    {
        ret.status=2;
        callback(null,ret);
        return;
    }

    var type="other";
    if (req.address.substr(req.address.length-3,2)=="md")
    {
        type="markdown";
    }

    var fs=require('fs-extra');
    var user=userMap.get(req.uuid).username;
    var filePath=__dirname+'/runtime/files/'+user+req.address;
    var net=require('net');
    var server=net.createServer(function(connection)
    {
        console.log('TCP Connect in');
        connection.on('end', function() {
            moveServerTime();
            fsDB.addNode(user,{
                type:type,
                path:req.address,
                timestamp:getServerTime()
            });
            console.log('File Transfer Done');
        });
        connection.on('data',function(data){
            fs.writeFile(filePath,data);
        })
    });

    //TCP服务器开始端口监听
    server.listen(0,function()
    {
        ret.ip=global.serverHost;
        ret.port=server.address().port;
        callback(null,ret);
    });
}
var getFileTree=function(call,callback)
{
    var ret={
        json:null
    }
    var req=call.request;
    if (!userMap.has(req.uuid)) //no such uuid
    {
        callback(null,ret);
        return;
    }
    var user=userMap.get(req.uuid).username;
    ret.json=fsDB.genTree(user);
    callback(null,ret);
}
var getTimeStamp=function(call,callback)
{
    var ret={
        json:getServerTime().toString()
    };
    callback(null,ret);
}

/* export functions */
exports.login=login;
exports.getDirInfo=getDirInfo;
exports.getFileInfo=getFileInfo;
exports.fileOperation=fileOperation;
exports.uploadReq=uploadReq;
exports.downloadReq=downloadReq;
exports.newFileReq=newFileReq;
exports.getFileTree=getFileTree;
exports.getTimeStamp=getTimeStamp;