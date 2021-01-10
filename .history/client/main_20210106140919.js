const { app, BrowserWindow } = require('electron')
const ipcmain = require('electron').ipcMain
const rpc = require('./rpc')

mainWindowID = 0

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
        // win.webContents.openDevTools()
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

ipcmain.on('loginsuccess', () => {
    curwin = BrowserWindow.fromId(mainWindowID)
    curwin.loadFile('main.html')
    curwin.setSi
        // curwin.webContents.openDevTools()
})

ipcmain.on('sendaddr-req', function(event, arg) {
    console.log(arg.ip);
    console.log(arg.port);
    var stub = rpc.getstub(arg.ip, arg.port);
    event.returnValue = stub;
})