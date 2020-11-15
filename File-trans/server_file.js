const express = require('express')
const bodyParser = require('body-parser')
const multer = require('multer')
const fs = require('fs')
const pathLib = require('path')

var objMulter = multer({ dest: './www/upload/' })

// 基于express框架的node服务器
var server = express()

// 允许所有类型的文件传递过来
server.use(objMulter.any())

server.post('/', function(req, res) {
    // 因为上传过来的文件名称比较复杂,我们需要给文件重新命名
    var newName = req.files[0].path + pathLib.parse(req.files[0].originalname).ext

    // 利用fs模块的文件重命名
    // req.files[0].path这个是文件的在传递中被修改的名字，newName是文件原名称,function回调函数
    fs.rename(req.files[0].path, newName, function(err) {
        if (err) {
            res.send('失败')
        } else {
            res.send('成功')
        }
    })


})

// 监听端口
server.listen(8080, function() {
    console.log('服务启动中~~')
});