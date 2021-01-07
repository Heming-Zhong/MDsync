const { app, BrowserWindow } = require('electron')
const ipcmain = require('electron').ipcMain
const rpc = require('./rpc')

mainWindowID = 0
userid = 0
var server_stub
var userfiletree

function createWindow() {
    const win = new BrowserWindow({
        width: 300,
        height: 300,
        webPreferences: {
            nodeIntegration: true
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

ipcmain.on('stub', (event, stub) => {
    server_stub = stub
    console.log("#debug server stub loaded")
})

// function getfiletree(cur_path) {
//     dircall = server_stub.getDirInfo({
//         unique_id: userid,
//         op: "getDirInfo",
//         address: cur_path
//     })
//     dircall.on("data", function(info) {

//     })
// }
function getfiletree() {
    server_stub.getFileTree({
        unique_id: userid,
        op: "getTree",
        address: "/"
    }, function(info) {
        userfiletree = JSON.parse(info)
    })

}

ipcmain.on('loginsuccess', (event, id) => {
    curwin = BrowserWindow.fromId(mainWindowID)
    userid = id

    curwin.loadFile('main.html')
    curwin.setSize(1080, 900)
        // curwin.webContents.openDevTools()
})

ipcmain.on('sendaddr-req', function(event, arg) {
    console.log(arg.ip);
    console.log(arg.port);
    var stub = rpc.getstub(arg.ip, arg.port);
    event.returnValue = stub;
})