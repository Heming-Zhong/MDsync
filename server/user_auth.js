var db=require('./runtime/db.json')

var auth=function(user,passwd)
{
    var userFound=db.user.filter(function(item)
    {
        return item.name==user;
    })
    var boolBack;
    if (userFound[0].passwd==passwd)
        return Promise.resolve("success!");
    else return Promise.reject("Failed!");
}

exports.auth=auth;