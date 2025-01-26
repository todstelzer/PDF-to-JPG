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

expressApp.post('/convert', upload.single('pdf'), (req, res) => {
    try {
        const defaultPath = path.join(os.homedir(), 'Downloads');
        const outputPath = req.body.folderPath || defaultPath;
        const inputPath = req.file.path;
        
        // Get original filename without .pdf extension
        const originalName = req.file.originalname.replace(/\.pdf$/i, '');

        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const outputFilePattern = path.join(outputPath, originalName);
        const popplerBinPath = app.isPackaged 
            ? path.join(process.resourcesPath, 'poppler', 'bin')
            : path.join(__dirname, 'poppler', 'bin');
        const pdftoppmPath = path.join(popplerBinPath, 'pdftoppm.exe');
        
        console.log('Starting conversion...', { inputPath, outputPath, originalName });
        const command = `"${pdftoppmPath}" -jpeg "${inputPath}" "${outputFilePattern}"`;

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Conversion error: ${error.message}`);
                return res.status(500).send('Conversion failed: ' + error.message);
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            console.log(`Stdout: ${stdout}`);

            fs.unlinkSync(inputPath);
            res.send('Conversion successful! Check output folder.');
        });
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
    return result.filePaths[0];
});

// Add new IPC handlers before createWindow function
ipcMain.handle('get-auto-convert', () => {
    return settings.getAutoConvert();
});

ipcMain.handle('set-auto-convert', (event, value) => {
    settings.setAutoConvert(value);
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,              // Reduced from 800 to fit content
        height: 650,             // Adjusted to fit elements
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,  // Enable context isolation
            preload: path.join(__dirname, 'preload.js')  // Add preload script
        },
        autoHideMenuBar: true,    // Hide the menu bar
        frame: true,              // Keep window frame
        minimizable: true,        // Allow minimize
        maximizable: false,       // Disable maximize since we want fixed size
        fullscreenable: false,    // Disable full screen
        resizable: false          // Disable resizing for perfect fit
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