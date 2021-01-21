const fs = require("fs-extra");
const path = require('path');
if (!fs.existsSync(path.join(__dirname,"beta.db")))
{
    var beta = require("better-sqlite3")("beta.db");
    beta.prepare("create table user (id int,name varchar(20),passwd varchar(50),primary key(id))").run();
}
else
{
    var db = require("better-sqlite3")("beta.db");
    var query = db.prepare("select * from user where name='zetako'").all();
    console.log(query);
}