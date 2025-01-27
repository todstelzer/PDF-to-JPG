const fs = require('fs');
const path = require('path');
const os = require('os');

class Settings {
    constructor() {
        this.settingsPath = path.join(os.homedir(), 'pdf-converter-settings.json');
        this.settings = this.loadSettings();
    }

    loadSettings() {
        try {
            if (fs.existsSync(this.settingsPath)) {
                return JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        return { 
            defaultOutputPath: path.join(os.homedir(), 'Downloads'),
            autoConvert: false,
            alwaysOnTop: false  // Add this line
        };
    }

    saveSettings() {
        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    getDefaultOutputPath() {
        return this.settings.defaultOutputPath;
    }

    setDefaultOutputPath(path) {
        this.settings.defaultOutputPath = path;
        this.saveSettings();
    }

    getAutoConvert() {
        return this.settings.autoConvert;
    }

    setAutoConvert(value) {
        this.settings.autoConvert = value;
        this.saveSettings();
    }

    getAlwaysOnTop() {
        return this.settings.alwaysOnTop;
    }

    setAlwaysOnTop(value) {
        this.settings.alwaysOnTop = value;
        this.saveSettings();
    }
}

module.exports = new Settings();
