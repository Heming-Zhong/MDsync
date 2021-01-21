const wrongPath=1;

var parsePath=function(username,path)//only parse dir!
{
    const userDB=require('./runtime/files/'+username+'/file.json');
    var objNow=userDB.file;

    var pathArr=path.split('/');
    if (pathArr[0]!='') return wrongPath;
    for (let i=0;i<pathArr.length;i++)
    {
        var tmp;
        for (let j=0;j<objNow.length;j++)
        {
            if (objNow[j].name==pathArr[i]) tmp.push(j);
        }

        //return when empty array (no such name)
        if (tmp.length==0) return wrongPath;
        //deal with situation when file/dir has same name
        for (itor in tmp)
        {
            if (objNow[itor].content!=null) break;
        }
        objNow=objNow[itor].content;
    }

    return objNow;
}

var parseFile=function(username,path)//only parse file!
{
    const userDB=require('./runtime/files/'+username+'/file.json');
    var objNow=userDB.file;

    var pathArr=path.split('/');
    if (pathArr[0]!='') return wrongPath;
    for (let i=0;i<pathArr.length;i++)
    {
        var tmp;
        for (let j=0;j<objNow.length;j++)
        {
            if (objNow[j].name==pathArr[i]) tmp.push(j);
        }

        //return when empty array (no such name)
        if (tmp.length==0) return wrongPath;
        //deal with situation when file/dir has same name
        if (i==pathArr.length-1)
        {
            for (itor in tmp)
            {
                if (objNow[itor].content==null) break;
            }
            objNow=objNow[itor];
        }
        else
        {
            for (itor in tmp)
            {
                if (objNow[itor].content!=null) break;
            }
            objNow=objNow[itor].content;
        }
    }

    return objNow;
}

var deleteNode=function(username,path,type)
{
    var fs=require('fs');
    var userDB=fs.readFileSync('./runtime/files/'+username+'/file.json');
    userDB=JSON.parse(userDB);

    var pathArr=path.split('/');
    if (pathArr[0]!='') return wrongPath;
    var objNow=userDB.file;
    for (let i=0;i<pathArr.length;i++)
    {
        var tmp;
        for (let j=0;j<objNow.length;j++)
        {
            if (objNow[j].name==pathArr[i]) tmp.push(j);
        }

        //return when empty array (no such name)
        if (tmp.length==0) return wrongPath;
        //deal with situation when file/dir has same name
        if (i==pathArr.length-2)
        {
            switch(type)
            {
            case 'dir'://dir
                //find dir
                for (itor in tmp)
                {
                    if (objNow[itor].content!=null) break;
                }
                //splice index
                objNow.splice(itor,1);
            case 'file'://file
                //find file
                for (itor in tmp)
                {
                    if (objNow[itor].content==null) break;
                }
                //splice index
                objNow.splice(itor,1);
            }
        }
        else
        {
            for (itor in tmp)
            {
                if (objNow[itor].content!=null) break;
            }
            objNow=objNow[itor].content;
        }
    }

    userDB=JSON.stringify(userDB);
    fs.writeFileSync('./runtime/files/'+username+'/file.json',userDB)
}

exports.wrongPath=wrongPath;
exports.parsePath=parsePath;
exports.parseFile=parseFile;
exports.deleteNode=deleteNode;
