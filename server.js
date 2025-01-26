const isPackaged = require('electron').app ? require('electron').app.isPackaged : false;
const os = require('os'); // Add this line

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-poppler');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.get('/', (req, res) => {
    res.sendFile(path.join(
      isPackaged ? process.resourcesPath : __dirname,
      'public',
      'index.html'
    ));
  });

// Replace the poppler path configuration with:
const popplerPath = isPackaged
  ? path.join(process.resourcesPath, 'poppler', 'bin')
  : path.join(__dirname, 'poppler', 'bin');

// Verify path exists
if (!fs.existsSync(popplerPath)) {
    throw new Error(`Missing poppler binaries at: ${popplerPath}`)
  }

// Serve static files
app.use(express.static(isPackaged 
    ? path.join(process.resourcesPath, 'public') 
    : path.join(__dirname, 'public'))
  );

// Handle conversion
app.post('/convert', upload.single('pdf'), async (req, res) => {
    try {
        const outputPath = req.body.folderPath || path.join(os.homedir(), 'Downloads'); // Update this line
        const inputPath = req.file.path;

        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        // Convert PDF to JPG
        await pdf.convert(inputPath, {
            format: 'jpeg',
            out_dir: outputPath,
            out_prefix: 'page',
            page: null,
            poppler_path: path.join(process.pkg ? path.dirname(process.execPath) : __dirname, 'poppler', 'bin')
        });

        // Cleanup temporary file
        fs.unlinkSync(inputPath);

        res.send('Conversion successful! Check output folder.');
    } catch (error) {
        console.error(error);
        res.status(500).send('Conversion failed: ' + error.message);
    }
});

// Start server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});