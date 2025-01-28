const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const settings = require('./settings');

let mainWindow;

// Create Express app
const expressApp = express();
const upload = multer({ dest: 'uploads/' });

// Configure Express routes
expressApp.get('/', (req, res) => {
    const publicPath = app.isPackaged
        ? path.join(process.resourcesPath, 'public', 'index.html')
        : path.join(__dirname, 'public', 'index.html');
    res.sendFile(publicPath);
});

expressApp.use(express.static(app.isPackaged 
    ? path.join(process.resourcesPath, 'public') 
    : path.join(__dirname, 'public'))
);

// Update the defaultPath route
expressApp.get('/defaultPath', (req, res) => {
    res.send(settings.getDefaultOutputPath());
});

let conversionQueue = [];
let isConverting = false;

function processQueue() {
    if (conversionQueue.length === 0) {
        isConverting = false;
        return;
    }

    isConverting = true;
    const { inputPath, outputPath, originalName, res } = conversionQueue.shift();
    const popplerBinPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'poppler', 'bin')
        : path.join(__dirname, 'poppler', 'bin');
    const pdftoppmPath = path.join(popplerBinPath, 'pdftoppm.exe');
    const outputFilePattern = path.join(outputPath, originalName);
    
    console.log('Starting conversion...', { inputPath, outputPath, originalName });
    const command = `"${pdftoppmPath}" -jpeg "${inputPath}" "${outputFilePattern}"`;
    console.log(command);

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Conversion error: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).send('Conversion failed: ' + error.message);
            }
        } else {
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            console.log(`Stdout: ${stdout}`);
            fs.unlinkSync(inputPath);
            settings.setBrowseOutputPath(outputPath);
        }
        if (conversionQueue.length === 0) {
            if (!res.headersSent) {
                res.send('All conversions successful!');
            }
            isConverting = false;
        } else {
            processQueue();
        }
    });
}

expressApp.post('/convert', upload.array('pdf', 10), (req, res) => {
    try {
        const defaultPath = settings.getDefaultOutputPath();
        const outputPath = req.body.folderPath || defaultPath;

        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        req.files.forEach(file => {
            const inputPath = file.path;
            const originalName = file.originalname.replace(/\.pdf$/i, '');
            const outputFilePattern = path.join(outputPath, originalName);

            console.log('Adding to queue:', { inputPath, outputPath, originalName });
            conversionQueue.push({ inputPath, outputPath, originalName, res });
        });

        if (!isConverting) {
            console.log('Starting queue processing');
            processQueue();
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Conversion failed: ' + error.message);
    }
});

// Add new IPC handlers before createWindow function
ipcMain.handle('get-default-path', () => {
    return settings.getDefaultOutputPath();
});

ipcMain.handle('set-default-path', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Default Output Directory'
    });
    if (!result.canceled && result.filePaths[0]) {
        settings.setDefaultOutputPath(result.filePaths[0]);
        return result.filePaths[0];
    }
    return null;
});

// Add this before createWindow function
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths[0]) {
        settings.setBrowseOutputPath(result.filePaths[0]);
        return result.filePaths[0];
    }
    return null;
});

// Add new IPC handlers before createWindow function
ipcMain.handle('get-auto-convert', () => {
    return settings.getAutoConvert();
});

ipcMain.handle('set-auto-convert', (event, value) => {
    settings.setAutoConvert(value);
});

// Add new IPC handlers before createWindow function
ipcMain.handle('get-always-on-top', () => {
    return settings.getAlwaysOnTop();
});

ipcMain.handle('set-always-on-top', (event, value) => {
    settings.setAlwaysOnTop(value);
    mainWindow.setAlwaysOnTop(value);
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 460,              // Reduced from 580 to 430 (150px less)
        height: 630,             // Keep height the same
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,  // Enable context isolation
            preload: path.join(__dirname, 'preload.js')  // Add preload script
        },
        autoHideMenuBar: true,    // Hide the menu bar
        frame: true, 
        minimizable: true,        // Allow minimize
        maximizable: false,       // Disable maximize since we want fixed size
        fullscreenable: false,    // Disable full screen
        resizable: false,         // Disable resizing for perfect fit
        alwaysOnTop: settings.getAlwaysOnTop()  // Add this line
    });

    // Remove menu bar completely
    mainWindow.removeMenu();

    mainWindow.loadURL('http://localhost:3000');
    // mainWindow.webContents.openDevTools(); // Uncomment for debugging

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    // Start Express server first
    expressApp.listen(3000, () => {
        console.log('Server running on http://localhost:3000');
        // Then create the window
        createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});