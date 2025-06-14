import https from 'https';
import fs from 'fs';

const timestamp = Date.now();
const url = `https://megacloud.blog/js/player/a/v2/pro/embed-1.min.js?v=${timestamp}`;
const output = 'input.txt';

https.get(url, (res) => {
    if (res.statusCode !== 200) {
        console.error('Error al descargar:', res.statusCode);
        res.resume();
        return;
    }
    const fileStream = fs.createWriteStream(output);
    res.pipe(fileStream);

    fileStream.on('finish', () => {
        fileStream.close();
        console.log('Descarga completa. Guardado en', output);
    });
}).on('error', (err) => {
    console.error('Error en la petición:', err.message);
});