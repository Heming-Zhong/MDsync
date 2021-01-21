const wrongPath=1;

var splitAddr=function(addr)
{
    var dirName,fileName;
    var pathArr=addr.split('/');
    if (pathArr[0]!=''||pathArr.length<=1) return wrongPath;
    fileName=pathArr[pathArr.length-1];
    dirName=addr.substr(0,addr.length-fileName.length-1);

    return {
        dirname:dirName,
        filename:fileName
    };
}

function probeDB(username)
{
    const fs=require("fs-extra");
    const path=require("path");
    var dir="runtime/file/"+username+"/.info.db";
    dir=path.join(__dirname,dir);
    var db;
    if (!fs.existsSync(dir))//not exist
    {
        db=require("better-sqlite3")(dir);
        db.prepare("create table file(id integer primary key autoincrement,name varchar(50),type varchar(10),path varchar(300),parent int,timestamp int);").run();
        db.prepare("insert into file(name,type,path,parent,timestamp) values(?,?,?,?,?)").run(username,"directory","/",0,0);
    }
    else
    {
        db=require("better-sqlite3")(dir);
    }
    return db;
}

var parsePath=function(username,path)//only parse dir!
{
    var db=probeDB(username);
    var id=db.prepare("select id from file where path=? and type='dir'").all(path);
    if (id.length==0) return wrongPath;
    id=id[0].id;
    var list=db.prepare("select name,type form file where parent=?").all(id);
    return list;
}
var parseFile=function(username,path)//only parse file!
{
    var db=probeDB(username);
    var fileAttr=db.prepare("select name,type from file where path=? and type='dir'").all(path);
    if (fileAttr.length==0) return wrongPath;
    fileAttr=fileAttr[0];
    return fileAttr
}
var deleteNode=function(username,path,type)
{
    var db=probeDB(username);
    var node=db.prepare("select id from file where path=? and type=?").all(path,type);
    if (node.length==0) return wrongPath;
    
    var nodeQueue=[node.id];
    node=db.prepare("select id from file where parent=?");
    while (nodeQueue.length!=0)
    {
        tmp=nodeQueue[0];
        nodeQueue.shift();
        db.prepare("delete from file where id=?").run(tmp);
        tmp=node.all(tmp);
        for (i in tmp)
        {
            nodeQueue.push(i.id);
        }
    }

    return null;
}
function changeTimeStamp(username,id,timeStamp)
{
    var db=probeDB(username);
    db.prepare("update file set timestamp=? where id=?").run(timeStamp,id);
    var tmp=db.prepare("select parent from file where id=?").all(id);
    if (tmp.length==0) return;
    id=tmp[0].id;
    changeTimeStamp(username,id,timeStamp);
    return;
}
var addNode=function(username,info)
{
    var db=probeDB(username);
    //get parent id
    var parentPath=splitAddr(info.path);
    var nodeName=parentPath.filename;
    parentPath=parentPath.dirname;
    var parent;
    if (parentPath=='') parent=1;
    else
    {
        parent=db.prepare("select id from file where path=? and type='directory'").get(parentPath);
        parent=parent.id;
    }
    //insert
    db.prepare("insert into file(name,type,path,parent,timestamp) values(?,?,?,?,?)")
        .run(nodeName,
            info.type,
            info.path,
            parent,
            info.timestamp);
    //change timestamp
    var id=db.prepare("select id from file where path=? and type=?").get(info.path,info.type);
    id=id.id;
    changeTimeStamp(username,id,info.timestamp);
    return null;
}
var updateNode=function(username,info)//for debug!never use it!
{
    var db=probeDB(username);
    var node=db.prepare("select id from file where path=? and type=?").all(info.path,info.type);
    if (node.length==0) return wrongPath;

    db.prepare("update file set name=?,path=?,parent=? where id=?")
        .run(info.filename,
            info.path,
            info.parent,
            node.id);

    if (info.timestamp!=null) changeTimeStamp(username,node.id,info.timestamp)
    return null;
}
var moveNode=function(username,oldPath,type,newPath,timeStamp)
{
    var db=probeDB(username);
    var newArr=splitAddr(newPath);
    
    var id=db.prepare("select id from file where path=? and type=?").all(oldPath,type);
    if (id.length==0) return wrongPath;
    id=id[0].id;
    var parent=db.prepare("select id from file where path=? and type='directory'").all(newArr.dirname);
    if (parent.length==0) return wrongPath;
    parent=id[0].id;
    db.prepare("update file set name=?,path=?,parent=? where id=?")
        .run(newArr.filename,
            newPath,
            parent,
            id);
    changeTimeStamp(username,id,timeStamp)
    return;
}

function genTree(user)
{
    var db=probeDB(user);
    var ret=[];

    var array=db.prepare("select * form file").all();
    for (i in array)
    {
        ret.push({
            id:i.id.toString(),
            parent:(i.parent==0)?"#":i.parent.toString(),
            text:i.name,
            timestamp:i.timestamp,
            type:i.type,
            path:i.path,
        });
    }
    return JSON.stringify(ret);
}

exports.changeTimeStamp=changeTimeStamp;
exports.genTree=genTree;

exports.wrongPath=wrongPath;
exports.parsePath=parsePath;
exports.parseFile=parseFile;
exports.deleteNode=deleteNode;
exports.addNode=addNode;
exports.updateNode=updateNode;
exports.splitAddr=splitAddr;
exports.moveNode=moveNode;