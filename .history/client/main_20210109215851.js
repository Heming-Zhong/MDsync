const { app, BrowserWindow } = require('electron')
const ipcmain = require('electron').ipcMain
const rpc = require('./rpc')

mainWindowID = 0
userid = 0
var server_stub
var userfiletree
var curwin

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
        } else {
            userfiletree = JSON.parse(info)
            curwin.webContents.send("filetree", userfiletree)
        }
    })

}

ipcmain.on('loginsuccess', (event, id) => {
    curwin = BrowserWindow.fromId(mainWindowID)
    userid = id
    curwin.loadFile('main.html')
    curwin.setSize(1080, 900)
    getfiletree()
        // curwin.webContents.openDevTools()
})

ipcmain.on('sendaddr-req', function(event, arg) {
    console.log(arg.ip);
    console.log(arg.port);
    var stub = rpc.getstub(arg.ip, arg.port);
    event.returnValue = stub;
})

ipcmain.on("upload", function(event, filepaths) {

    request = { uuid: userid, op: "uploadReq", address: }
})