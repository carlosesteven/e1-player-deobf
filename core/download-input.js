import https from 'https';
import fs from 'fs';
import path from 'path';

const timestamp = Date.now();

const url = `https://megacloud.blog/js/player/a/v2/pro/embed-1.min.js?v=${timestamp}`;

const repoRoot = path.resolve(__dirname, '..'); // Si este archivo está en /core
const outputDir = path.join(repoRoot, 'output');
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
        console.log('Download complete. Saved to', outputFile);
    });
}).on('error', (err) => {
    console.error('Request error:', err.message);
});