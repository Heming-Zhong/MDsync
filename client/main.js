const { app, BrowserWindow } = require('electron')
const ipcmain = require('electron').ipcMain
const rpc = require('./rpc')
var fs = require('fs')
const net = require('net')

localdata = './local' // 本地的数据根目录
mainWindowID = 0 // 主窗口的ID
userid = 0 // 登录后从服务器那里得到的用户UID
var server_stub // 保存下来的服务器RPC存根 
var userfiletree // 本地保存的远程文件树结构，以对象形式保存
var curwin // 当前主窗口对象
var localvectime = -1 // 本次向量时间戳
var updatingqueue = [] // 要更新的节点信息
var localnode = [] // 本地存在的远程文件拷贝
var mdfileshowndata = "" // 显示在主页的MD渲染内容
var serverip = "" // 服务器IP地址

// NOTE 创建主窗口
function createWindow() {
    const win = new BrowserWindow({
        width: 400,
        height: 460,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    })

    win.loadFile('index.html') // 首先加载登录界面
    mainWindowID = win.id
        // var contents = win.webContents
        // 打开调试界面，以后需要删去
        // win.webContents.openDevTools()
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    // 非macOS平台，关闭所有窗口就直接退出程序
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// NOTE 事件 stub
// 将index.html中已有的RPC stub传到主进程保存
ipcmain.on('stub', (event, stub) => {
    serverip = stub.ip
    port = stub.port
    server_stub = rpc.getstub(serverip, port)
        // console.log(server_stub)
    console.log("#debug server stub loaded")
})

var testwin
    // NOTE 事件 loginsuccess
    // 登录成功之后，将界面由登录界面切换成主界面
ipcmain.on('loginsuccess', (event, data) => {
    curwin = BrowserWindow.fromId(mainWindowID)
    userid = data.id // 保存登录RPC返回的UID
    serverip = data.ip
    curwin.loadFile('main.html') // 加载主界面
    curwin.setSize(1080, 900)
    curwin.webContents.on("did-finish-load", () => {
        getfiletree()
        setInterval(updatelocaltree, 1500) // 设置检查同步状态的定时任务
    })
    testwin = curwin
        // curwin.webContents.openDevTools()
})

// NOTE 事件 upload
// 将新加入的本地文件上传到在线数据库的指定位置
ipcmain.on("upload", function(event, data) {
    var localpath = data.localpath
    var clouddic = data.cloudpath
    var filename = data.filename
    var filenode = data.treenode

    // 暂时先不考虑相关资源文件的拷贝，只拷贝目标文件
    // for (var i = 0; i < localpaths.length; i++) {
    checkdir(localdata + clouddic)
    fs.copyFileSync(localpath, localdata + clouddic)
        // }

    arr = filename.split('.')
    var postfix = arr[arr.length - 1]

    request = { uuid: userid, op: "newFileReq", address: clouddic, extra: "" }

    // 上传RPC回调
    function uploadcallback(error, socketinfo) {
        if (error) {
            console.log("发送失败!")
        } else {
            // ip = socketinfo.ip
            ip = serverip
            port = socketinfo.port
            stat = socketinfo.status

            if (stat == 0) {
                // 建立文件传输Socket
                let client = new net.Socket()
                client.connect(port, ip)
                client.setEncoding('utf8')
                filecontent = fs.readFileSync(localpath)
                client.write(filecontent)
                console.log("发送成功!")
                client.end()

                client.on('end', function() {
                    fileinforeq = { uuid: userid, op: "getFileInfo", address: clouddic, extra: "" }

                    function fileinfocallback(error, fileinfo) {
                        if (error) {
                            console.log("服务端文件信息错误")
                        } else {
                            id = fileinfo.id
                            filenode.id = id
                            console.log(id)
                            if (!exists(id)) {
                                filenode.original.id = id
                                localnode.push(filenode.original)
                            }
                            if (postfix == 'md') {
                                mdfileshowndata = filecontent.toString('utf8')
                                curwin.webContents.send("update shown", {
                                    data: mdfileshowndata,
                                    id: id
                                })
                            }
                            event.returnValue = id
                                // getfiletree()
                        }
                    }
                    server_stub.getFileInfo(fileinforeq, fileinfocallback)
                })
            } else {
                console.log("发送失败!")
            }
        }
    }
    server_stub.newFileReq(request, uploadcallback)

})

// NOTE 事件 download
// 将不存在于本地的文件下载到本地
ipcmain.on("download", (event, data) => {
    path = data.path
    node = data.node
    var filename = data.name
    var localpath = localdata + path
    request = { uuid: userid, op: "downloadReq", address: path }

    var tempdata = ""
    console.log(localpath)

    existflag = existslocal(node)
    if (existflag) {
        console.log("本地存在副本，取消下载...")
        tempdata = fs.readFileSync(localpath)
            // arr = filename.split('.')
            // postfix = arr[arr.length - 1]
        if (node.original.type == 'markdown') {
            mdfileshowndata = tempdata.toString("utf8")
                // console.log(mdfileshowndata)
                // curwin.webContents.send("update shown", mdfileshowndata)
            event.sender.send("update shown", {
                data: mdfileshowndata,
                id: node.id
            })
        }
    } else {
        console.log("本地不存在副本，执行下载...")

        function downloadcallback(error, socketinfo) {
            if (error) {
                console.log("下载出现错误!")
            } else {
                // ip = socketinfo.ip
                ip = serverip
                port = socketinfo.port
                stat = socketinfo.status
                if (stat == 0) {
                    let client = new net.Socket()
                    client.connect(port, ip)
                    client.setEncoding('utf8')
                    client.on("data", function(data) {

                        checkdir(localpath.substr(0, localpath.length - filename.length))
                        fs.writeFileSync(localpath, data)
                        tempdata += data
                    })

                    client.on("end", function() {
                        console.log("socket end")
                            // console.log("downloaded data:" + tempdata)
                        if (node.original.type == 'markdown') {
                            mdfileshowndata = tempdata.toString("utf8")
                                // console.log(tempdata)
                            curwin.webContents.send("update shown", {
                                data: mdfileshowndata,
                                id: node.id
                            })
                        }
                        console.log("下载成功!")
                        if (!exists(node.id)) {
                            node.original.id = node.id
                            localnode.push(node.original) // 本地只记录文件节点的信息，即叶节点
                        }
                    })

                    // arr = filename.split('.')
                    // postfix = arr[arr.length - 1]
                } else {
                    console.log("下载失败!")
                }
            }
        }
        server_stub.downloadReq(request, downloadcallback)
    }

})

// NOTE 事件 createdir
// 发送创建目录的消息到服务器
ipcmain.on("createdir", (event, data) => {

    function mkdircallback(error, response) {
        if (error) {
            console.log("与服务器通信出现错误!")
        } else {
            status = response.status
            if (status == 0) {
                console.log("Operation success")
            }
            event.returnValue = response.uuid
        }
    }
    op = "mkdir"
    address = data
    server_stub.fileOperation({
        uuid: userid,
        op: op,
        address: address,
        extra: ""
    }, mkdircallback)
})

// NOTE 事件 rename
// 向服务器请求对文件或目录的重命名
ipcmain.on("rename", (event, data) => {
    path = data.path
    newname = data.name
    node = data.node

    console.log("rename...")

    function renamecallback(error, response) {
        console.log("callback")
        if (error) {
            console.log("与服务器通信出现错误!")
        } else {
            status = response.status
            if (status == 0) {
                console.log("Operation success")
            }
        }
    }
    request = {
        uuid: userid,
        op: "rename",
        address: path,
        extra: newname
    }
    server_stub.fileOperation(request, renamecallback)
})

// NOTE 事件 rm
// 向服务器请求执行删除操作
ipcmain.on("rm", (event, data) => {
    path = data.path
    dir = data.dir
    op = dir ? "rmdir" : "rm"

    function rmcallback(error, response) {
        if (error) {
            console.log("与服务器通信出现错误!")
        } else {
            curwin.webContents.send("rmstate", response.status)
        }
    }
    server_stub.fileOperation({
        uuid: userid,
        op: op,
        address: path,
        extra: ""
    }, rmcallback)
})

// NOTE 事件 move
// 移动文件和目录
ipcmain.on("move", (event, data) => {
    oldpath = data.oldpath
    newpath = data.newpath
    node = data.node

    var op
    if (node.original.type == "directory") {
        op = "mvdir"
    } else {
        op = "mv"
    }

    function mvcallback(error, response) {
        if (error) {
            console.log("与服务器通信出现错误!")
        } else {
            status = response.status
            if (status == 1) {
                console.log("出现错误")
            }
            event.returnValue = status
        }
    }
    server_stub.fileOperation({
        uuid: userid,
        op: op,
        address: oldpath,
        extra: newpath
    }, mvcallback)
})


// NOTE: 事件 dataupload
// 上传修改后的文件内容
ipcmain.on("dataupload", (event, arg) => {
    id = arg.id
    data = arg.data
        // 先要找到对应节点的路径
    var validpath = false
    var path
    for (i in userfiletree) {
        if (userfiletree[i].id == id) {
            path = userfiletree[i].path
            validpath = true
            break
        }
    }
    if (validpath) {
        console.log("designated path: " + path)

        function updatecallback(error, socketinfo) {
            if (error) {
                console.log("与服务器通信出现错误!")
            } else {
                ip = socketinfo.ip
                port = socketinfo.port
                status = socketinfo.status
                if (status == 0) {
                    let client = new net.Socket()
                    client.connect(port, ip)
                    client.setEncoding('utf8')
                    client.write(data)
                    console.log("同步成功!")
                    client.end()
                }
            }
        }
        server_stub.uploadReq({
            uuid: userid,
            op: "uploadReq",
            address: path,
            extra: ""
        }, updatecallback)
    } else {
        console.log("Error: invalid id...")
    }

})

// NOTE getfiletree
// 从服务器获取新的远程文件目录树，并更新本地信息
function getfiletree() {
    server_stub.getFileTree({
        uuid: userid,
        op: "getTree",
        address: "/",
        extra: ""
    }, function(error, info) {
        if (error) {
            console.log("get file info error")
        } else { // 得到新的树，并且和旧的本地树比较，并记录不同之处
            newfiletree = JSON.parse(info.json)

            // 只更新树信息，在后面的函数中更新本地内容
            userfiletree = newfiletree
                // console.log(userfiletree)
                // show new tree
                // console.log(info.json)
            if (curwin == testwin) {
                console.log("unchanged")
            } else {
                console.log("changed")
            }
            // curwin.webContents.send("test", info.json)
            curwin.webContents.send("filetree", info.json)
        }
    })
}

// NOTE updatefiles
// 更新本地的待更新目录和文件
function updatefiles() {
    // update nodes need to update

    console.log("updating..")
    console.log(localnode)
    console.log(userfiletree)
    for (i = 0; i < localnode.length; i++) {
        find_flag = false

        // find in user file tree
        for (j in userfiletree) {
            // find the node in tree
            if (localnode[i].id == userfiletree[j].id) {
                find_flag = true
                    // compare timestamp   
                console.log(localnode[i])
                console.log(userfiletree[j])
                if (localnode[i].timestamp < userfiletree[j].timestamp) {
                    checkdir(localdata + userfiletree[j].path)
                    oldfilepath = localdata + localnode[i].path
                    newfilepath = localdata + userfiletree[j].path
                    request = { uuid: userid, op: "downloadReq", address: userfiletree[j].path }
                    console.log("old" + oldfilepath)
                    console.log("new" + newfilepath)

                    function downloadcallback(error, socketinfo) {
                        if (error) {
                            console.log("下载出现错误!")
                        } else {
                            ip = socketinfo.ip
                            port = socketinfo.port
                            stat = socketinfo.status
                            let client = new net.Socket()
                            client.connect(port, ip)
                            client.setEncoding('utf8')
                            client.on("data", function(data) {
                                console.log(data)
                                    // checkdir(localpath - filename)
                                fs.writeFileSync(newfilepath, data)
                            })
                            console.log("下载成功")
                        }
                    }
                    server_stub.downloadReq(request, downloadcallback)

                    fs.unlinkSync(oldfilepath)

                    localnode[i] = userfiletree[j]
                }
                break
            }
        }
        // not find in new file tree, indicating this local copy need to be delete
        if (find_flag == false) {
            fs.unlinkSync(localdata + localnode[i].path)
            localnode.splice(i, 1)
            i--
        }
    }
    console.log("local copies all updated")
}

// NOTE checkupdate 
// 通过服务器的时间戳判断是否需要更新本地信息
function checkupdate() {
    server_stub.getTimeStamp({
            uuid: userid,
            op: "getTree",
            address: "timestamp",
            extra: ""
        },
        function(error, res) {
            time = parseInt(res.json)
            console.log(time)
            if (localvectime < time) {
                console.log("out of date... updating")
                console.log(localvectime)
                getfiletree() // update local tree
                updatefiles()
                localvectime = time
            } else {
                console.log("up to date")
            } // do nothing
        })
}


// NOTE  updatelocaltree
// 检查本地更新的函数
function updatelocaltree() {
    checkupdate()
}


// NOTE checkdir
// 检查当前路径是否存在，如果不存在，那么就创建
function checkdir(path) {
    console.log("checking" + path)
    const arr = path.split('/');
    let dir = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        dir = dir + '/' + arr[i];
    }
    // fs.writeFileSync(filePath, '')
}

// NOTE existslocal
// 检查对应的项是否存在于本地
function existslocal(node) {
    existflag = false
    for (i in localnode) {
        if (localnode[i].id == node.id && localnode[i].timestamp == node.timestamp) {
            existflag = true
            break
        }
    }
    return existflag
}

function exists(id) {
    for (i in localnode) {
        if (localnode[i].id == id) {
            return true
        }
    }
    return false
}