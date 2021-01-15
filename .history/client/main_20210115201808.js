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
    var localpath = data.localpath
    var clouddic = data.cloudpath
    var filename = data.filename

    // 暂时先不考虑相关资源文件的拷贝，只拷贝目标文件
    // for (var i = 0; i < localpaths.length; i++) {
    checkdir(localdata + clouddic)
    fs.copyFileSync(localpath, localdata + clouddic + '/' + filename)
        // }

    request = { uuid: userid, op: "uploadReq", address: clouddic + '/' + filename }

    // 上传RPC回调
    function uploadcallback(error, socketinfo) {
        if (error) {
            alert("发送失败!")
        } else {
            ip = socketinfo.ip
            port = socketinfo.port
            stat = socketinfo.status

            // 建立文件传输Socket
            let client = new net.Socket()
            client.connect(port, ip)
            client.setEncoding('utf8')
                // for (i = 0; i < localpaths.length; i++) {
            filecontent = fs.readFileSync(localpath)
            client.write(filecontent)
                // }
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
            localnode.push(node) // 本地只记录文件节点的信息，即叶节点
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

            // 只更新树信息，在后面的函数中更新本地内容
            userfiletree = newfiletree

            // show new tree
            curwin.webContents.send("filetree", userfiletree)
        }
    })
}

// 更新本地的待更新目录和文件
function updatefiles() {
    // update nodes need to update
    for (i = 0; i < localnode.length; i++) {
        find_flag = false

        // find in user file tree
        for (j in userfiletree) {
            // find the node in tree
            if (localnode[i].id == userfiletree[j].id) {
                find_flag = true
                    // compare timestamp   
                if (localnode[i].timestamp < userfiletree[j].timestamp) {
                    checkdir(localdata + userfiletree[j].path)
                    oldfilepath = localdata + localnode[i].path + '/' + localnode[i].text
                    newfilepath = localdata + userfiletree[j].path + '/' + userfiletree[j].text
                    fs.copyFileSync(oldfilepath, newfilepath)

                    fs.unlinkSync(oldfilepath)

                    localnode[i] = userfiletree[j]
                }
                break
            }
        }
        // not find in new file tree, indicating this local copy need to be delete
        if (find_flag == false) {
            localnode.splice(i, 1)
            fs.unlinkSync(localdata + localnode[i].path + '/' + localnode[i].text)
        }
    }
    console.log("local copies all updated")
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


// 检查当前路径是否存在，如果不存在，那么就创建
function checkdir(path) {
    const arr = path.split('/');
    let dir = arr[0];
    for (let i = 1; i < arr.length; i++) {
        if (!dirCache[dir] && !fs.existsSync(dir)) {
            dirCache[dir] = true;
            fs.mkdirSync(dir);
        }
        dir = dir + '/' + arr[i];
    }
    // fs.writeFileSync(filePath, '')
}