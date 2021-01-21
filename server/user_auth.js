var auth=function(user,passwd)
{
    const mainDB=require("better-sqlite3")("runtime/MDSync.db");
    var query=mainDB.prepare('select passwd from user where name=?');
    var result=query.all(user);
    var ret=false;
    for (i in result)
    {
        if (i.passwd==passwd) ret=true;
    }
    return ret;
}

exports.auth=auth;