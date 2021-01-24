const wrongPath=1;

var splitAddr=function(addr)
{
    var dirName,fileName;
    var pathArr=addr.split('/');
    if (pathArr[0]!=''||pathArr.length<=1) return wrongPath;
    fileName=pathArr[pathArr.length-1];
    dirName=addr.substr(0,addr.length-fileName.length-1);

    if (dirName=='') dirName='/';

    return {
        dirname:dirName,
        filename:fileName
    };
}

function probeDB(username)
{
    const fs=require("fs-extra");
    const path=require("path");
    var dir="runtime/files/"+username+"/.info.db";
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
    var id=db.prepare("select id from file where path=? and type='directory'").all(path);
    if (id.length==0) return wrongPath;
    id=id[0].id;
    var list=db.prepare("select id,name,type from file where parent=?").all(id);
    return list;
}
var parseDir=function(username,path)
{
    var db=probeDB(username);
    var fileAttr=db.prepare("select id,name,type from file where path=? and type='directory'").all(path);
    if (fileAttr.length==0) return wrongPath;
    fileAttr=fileAttr[0];
    return fileAttr;
}
var parseFile=function(username,path)//only parse file!
{
    var db=probeDB(username);
    var fileAttr=db.prepare("select id,name,type from file where path=? and type<>'directory'").all(path);
    if (fileAttr.length==0) return wrongPath;
    fileAttr=fileAttr[0];
    return fileAttr;
}
var deleteNode=function(username,path,type)
{
    var db=probeDB(username);
    var node=db.prepare("select id from file where path=? and type=?").all(path,type);
    if (node.length==0) return wrongPath;
    
    var nodeQueue=[node[0].id];
    node=db.prepare("select id from file where parent=?");
    while (nodeQueue.length!=0)
    {
        tmp=nodeQueue[0];
        nodeQueue.shift();
        db.prepare("delete from file where id=?").run(tmp);
        tmp=node.all(tmp);
        for (i in tmp)
        {
            nodeQueue.push(tmp[i].id);
        }
    }

    return null;
}



function changeTimeStamp(username,id,timeStamp)
{
    var db=probeDB(username);
    var update=db.prepare("update file set timestamp=? where id=?");
    var tmpID=id;
    while (true)
    {
        update.run(timeStamp,tmpID);
        var tmp=db.prepare("select parent from file where id=?").all(tmpID);
        if (tmp.length==0) return;
        tmpID=tmp[0].parent;
    }
}
var addNode=function(username,info)
{
    var db=probeDB(username);
    //get parent id
    var parentPath=splitAddr(info.path);
    var nodeName=parentPath.filename;
    parentPath=parentPath.dirname;
    
    var parent;
    parent=db.prepare("select id from file where path=? and type='directory'").get(parentPath);
    parent=parent.id;
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
    parent=parent[0].id;
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

    var array=db.prepare("select * from file").all();
    for (i in array)
    {
        ret.push({
            id:array[i].id.toString(),
            parent:(array[i].parent==0)?"#":array[i].parent.toString(),
            text:array[i].name,
            timestamp:array[i].timestamp,
            type:array[i].type,
            path:array[i].path,
        });
    }
    return JSON.stringify(ret);
}

exports.changeTimeStamp=changeTimeStamp;
exports.genTree=genTree;

exports.wrongPath=wrongPath;
exports.parsePath=parsePath;
exports.parseFile=parseFile;
exports.parseDir=parseDir;
exports.deleteNode=deleteNode;
exports.addNode=addNode;
exports.updateNode=updateNode;
exports.splitAddr=splitAddr;
exports.moveNode=moveNode;