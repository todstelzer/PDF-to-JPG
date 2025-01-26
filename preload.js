const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
    },
    settings: {
        getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
        setDefaultPath: () => ipcRenderer.invoke('set-default-path'),
        getAutoConvert: () => ipcRenderer.invoke('get-auto-convert'),
        setAutoConvert: (value) => ipcRenderer.invoke('set-auto-convert', value)
    }
});