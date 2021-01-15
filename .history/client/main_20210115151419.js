const { app, BrowserWindow } = require('electron')
const ipcmain = require('electron').ipcMain
const rpc = require('./rpc')
var fs = require('fs')
const net = require('net')

localdata = './' // 本地的数据根目录
mainWindowID = 0 // 主窗口的ID
userid = 0 // 登录后从服务器那里得到的用户UID
var server_stub // 保存下来的服务器RPC存根 
var userfiletree // 本地保存的远程文件树结构，以对象形式保存
var curwin // 当前主窗口对象
var localvectime = 0 // 本次向量时间戳
var updatingqueue = [] // 要更新的
var localnode = []

function createWindow() {
    const win = new BrowserWindow({
        width: 300,
        height: 300,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    })

    win.loadFile('index.html')
    mainWindowID = win.id
        // var contents = win.webContents
    win.webContents.openDevTools()
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// 将index.html中已有的RPC stub传到主进程保存
ipcmain.on('stub', (event, stub) => {
    server_stub = stub
    console.log("#debug server stub loaded")
})



function getfiletree() {
    server_stub.getFileTree({
        uuid: userid,
        op: "getTree",
        address: "/"
    }, function(error, info) {
        if (error) {
            console.log("get file info error")
        } else { // 得到新的树，并且和旧的本地树比较，并记录不同之处
            newfiletree = JSON.parse(info)

            // get all files needed to be update
            for (index in newfiletree) {
                for (jndex in userfiletree) {
                    //very unlikely
                    if (newfiletree[index].timestamp < userfiletree[jndex].timestamp) {
                        alert("服务器时钟故障")
                        alert("服务中止")
                    }

                    // using node id to find the same item 
                    if (newfiletree[index].id == userfiletree[jndex].id && newfiletree[index].timestamp > userfiletree[jndex].timestamp) {
                        // if its a dir and its path is not changed, then we only need to update files inside it
                        if (newfiletree[index].type == 'dir' && newfiletree[index].text == userfiletree[jndex].text) {
                            continue
                        } else {
                            updatingqueue.push(newfiletree[index])
                        }
                    }
                }
            }
            userfiletree = newfiletree
            curwin.webContents.send("filetree", userfiletree)
        }
    })
}

function updatefiles() {
    for (i in updatingqueue) {
        for (j in localnode) {
            if (updatingqueue[i].id == localnode[j].id) {
                fs.copyFileSync(localdata + localnode[j].path, localdata + updatingqueue[i].path)
                fs.unlinkSync(localdata + localnode[j].path)
                localnode[j].path = updatingqueue[i].path
            }
        }

    }
}

function gettimestamp() {
    server_stub.gettimestamp({
            uuid: userid,
            op: "getTree",
            address: "timestamp"
        }),
        function(error, time) {
            localvectime = time
            if (localvectime < time) {
                getfiletree() // update local tree
                updatefiles()
            } else {} // do nothing
        }
}

ipcmain.on('loginsuccess', (event, id) => {
    curwin = BrowserWindow.fromId(mainWindowID)
    userid = id
    curwin.loadFile('main.html')
    curwin.setSize(1080, 900)
    setTimeout(updatelocaltree, 1500)
        // curwin.webContents.openDevTools()
})

// ipcmain.on('sendaddr-req', function(event, arg) {
//     console.log(arg.ip);
//     console.log(arg.port);
//     var stub = rpc.getstub(arg.ip, arg.port);
//     event.returnValue = stub;
// })

//将本地文件上传到在线数据库的指定位置
ipcmain.on("upload", function(event, data) {
    var localpaths = data.localpath
    var clouddic = data.cloudpath
        // 暂时先不考虑相关资源文件的拷贝
    for (var i = 0; i < localpaths.length; i++) {
        fs.copyFileSync(localpaths[i], localdata + clouddic)
    }

    request = { uuid: userid, op: "uploadReq", address: clouddic }

    function uploadcallback(error, socketinfo) {
        if (error) {
            alert("发送失败!")
        } else {
            ip = socketinfo.ip
            port = socketinfo.port
            stat = socketinfo.status
            let client = new net.Socket()
            client.connect(port, ip)
            client.setEncoding('utf8')
            for (i = 0; i < localpaths.length; i++) {
                filecontent = fs.readFileSync(localpaths[i])
                client.write(filecontent)
            }
            alert("发送成功!")
        }
    }
    server_stub.uploadReq(request, uploadcallback)
})

// 将不存在于本地的文件下载到本地
ipcmain.on("download", (event, data) => {
    path = data.path
    node = data.node
    var localpath = localdata + path
    request = { uuid: userid, op: "downloadReq", address: path }

    function downloadcallback(error, socketinfo) {
        if (error) {
            alert("下载出现错误!")
        } else {
            ip = socketinfo.ip
            port = socketinfo.port
            stat = socketinfo.status
            let client = new net.Socket()
            client.connect(port, ip)
            client.setEncoding('utf8')
            client.on("data", function(data) {
                console.log(data)
                fs.writeFileSync(localpath, data)
            })
            console.log("下载成功")
            localnode.push(node)
        }
    }
    server_stub.downloadReq(request, downloadcallback)
})

function updatelocaltree() {
    gettimestamp()
}