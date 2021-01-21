const chalk=require('chalk');

var auth=function(user,passwd)
{
    const mainDB=require("better-sqlite3")("runtime/MDSync.db");
    var query=mainDB.prepare('select passwd from user where name=?');
    var result=query.all(user);
    var ret=false;
    for (i in result)
    {
        if (result[i].passwd==passwd) ret=true;
        if (!ret)
        {
            console.log(chalk.redBright('[server] login failed, input is '+passwd));
            console.log(chalk.redBright('[server] login failed, store is '+i.passwd));
        }
    }
    return ret;
}

exports.auth=auth;