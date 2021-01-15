const { app, BrowserWindow } = require('electron')
const ipcmain = require('electron').ipcMain
const rpc = require('./rpc')
var fs = require('fs')
const net = require('net')

localdata = './local/' // 本地的数据根目录
mainWindowID = 0 // 主窗口的ID
userid = 0 // 登录后从服务器那里得到的用户UID
var server_stub // 保存下来的服务器RPC存根 
var userfiletree // 本地保存的远程文件树结构，以对象形式保存
var curwin // 当前主窗口对象
var localvectime = 0 // 本次向量时间戳
var updatingqueue = [] // 要更新的节点信息
var localnode = [] // 本地存在的远程文件拷贝

// 创建主窗口
function createWindow() {
    const win = new BrowserWindow({
        width: 300,
        height: 300,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true
        }
    })

    win.loadFile('index.html') // 首先加载登录界面
    mainWindowID = win.id
        // var contents = win.webContents
        // 打开调试界面，以后需要删去
    win.webContents.openDevTools()
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

// 将index.html中已有的RPC stub传到主进程保存
ipcmain.on('stub', (event, stub) => {
    server_stub = stub
    console.log("#debug server stub loaded")
})

// 登录成功之后，将界面由登录界面切换成主界面
ipcmain.on('loginsuccess', (event, id) => {
    curwin = BrowserWindow.fromId(mainWindowID)
    userid = id // 保存登录RPC返回的UID
    curwin.loadFile('main.html') // 加载主界面
    curwin.setSize(1080, 900)
    setTimeout(updatelocaltree, 1500) // 设置检查同步状态的定时任务
        // curwin.webContents.openDevTools()
})

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

// 从服务器获取新的远程文件目录树，并更新本地信息
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
                            // exit
                    }

                    // using node id to find the same item 
                    if (newfiletree[index].id == userfiletree[jndex].id && newfiletree[index].timestamp > userfiletree[jndex].timestamp) {
                        // if its a dir and its path is not changed, then we only need to update files inside it
                        if (newfiletree[index].type == 'dir' && newfiletree[index].text == userfiletree[jndex].text) {
                            continue
                        } else {
                            // pushing this new node to the updating queue
                            updatingqueue.push(newfiletree[index])
                        }
                    }
                }
            }
            // replacing old tree with the new one
            userfiletree = newfiletree

            // show new tree
            curwin.webContents.send("filetree", userfiletree)
        }
    })
}

// 更新本地的待更新目录和文件
function updatefiles() {
    for (i in updatingqueue) {
        for (j in localnode) {
            if (updatingqueue[i].id == localnode[j].id) {
                // copy file to new location
                fs.copyFileSync(localdata + localnode[j].path, localdata + updatingqueue[i].path)

                // delete old file 
                fs.unlinkSync(localdata + localnode[j].path)

                // update local node info
                localnode[j].path = updatingqueue[i].path
                localnode[j].text = updatingqueue[i].text
            }
        }

    }
}

//通过服务器的时间戳判断是否需要更新本地信息
function checkupdate() {
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


// 检查本地更新的函数
function updatelocaltree() {
    checkupdate()
}