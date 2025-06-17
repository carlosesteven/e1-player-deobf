import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const timestamp = Date.now();
const url = `https://megacloud.blog/js/player/a/v2/pro/embed-1.min.js?v=${timestamp}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, '..', 'output');
const outputFile = path.join(outputDir, 'input.txt');

// Ensure the output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

https.get(url, (res) => {
    if (res.statusCode !== 200) {
        console.error('Download error:', res.statusCode);
        res.resume();
        return;
    }
    const fileStream = fs.createWriteStream(outputFile);
    res.pipe(fileStream);

    fileStream.on('finish', () => {
        fileStream.close();
        console.log("");
        console.log("");
        console.log('- Download complete. Saved to', outputFile);
        console.log("");
        console.log("");
    });
}).on('error', (err) => {
    console.error('Request error:', err.message);
});