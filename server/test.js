var ori='/src/test.txt';

var arr=ori.split('/');
//console.log(arr);

var db=require('./runtime/files/zetako/file.json');
var obj=db.file[1].content.file[0];
console.log(obj);
console.log(JSON.stringify(obj));