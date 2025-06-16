import fs from 'fs';
import path from 'path';
import { sendErrorEmail, sendNewKeyEmail } from './send-email.js';
import { fileURLToPath } from 'url';

async function main() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const repoRoot = path.resolve(__dirname, '..'); 

    const outputDir = path.join(repoRoot, 'output');

    // Read the deobfuscated JS file from output/output.js
    const code = fs.readFileSync(path.join(outputDir, 'output.js'), 'utf-8');

    // This regex supports and extracts the decryption key regardless of leading or trailing dashes,
    // handling all formats like: "key", "-key", "--key", "key-", "key--", "-key-", "--key--" (and all combinations).
    // Permite cualquier cantidad de guiones antes o después del key:
const keyMatch = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*["'`]-*([0-9a-fA-F]{64})-*["'`]/);

    let key = null;

    if (keyMatch) {
        key = keyMatch[2];
        console.log("Key found directly:", key);
    } else {
        // Try to find an array of 64 hex strings (e.g., O = ["30", ...])
        const arrayMatch = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*\[((?:"[0-9a-fA-F]{2}",?\s*){64})\]/);

        if (arrayMatch) {
            const hexStrings = arrayMatch[0].match(/"([0-9a-fA-F]{2})"/g).map(s => s.replace(/"/g, ''));
            // Opción 1: key como texto ASCII
            const asciiKey = hexStrings.map(h => String.fromCharCode(parseInt(h, 16))).join('');
            // Opción 2: key como hex puro
            const hexKey = hexStrings.join('');
        
            // ¿Cuál usar? Priorizamos ASCII si es printable y longitud 64, si no el hex
            if (/^[\x20-\x7E]{64}$/.test(asciiKey)) { // 64 caracteres ASCII imprimibles
                key = asciiKey;
                console.log("Key built from array of hex strings (as ASCII):", key);
            } else if (hexKey.length === 128 && /^[0-9a-fA-F]+$/.test(hexKey)) {
                key = hexKey;
                console.log("Key built from array of hex strings (as HEX):", key);
            } else {
                console.error("Array of hex strings found, but neither ASCII nor HEX version is valid.");
                await sendErrorEmail("Array of hex strings found, but neither ASCII nor HEX version is valid.");
                process.exit(1);
            }
        } else {
            const decimalArrayMatch = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*\[((?:\d+,?\s*){64})\]/);
            if (decimalArrayMatch) {
                const decNumbers = decimalArrayMatch[0].match(/\d+/g).map(Number);
                const asciiKey = decNumbers.map(n => String.fromCharCode(n)).join('');
                const hexKey = decNumbers.map(n => n.toString(16).padStart(2, '0')).join('');

                if (/^[\x20-\x7E]{64}$/.test(asciiKey)) {
                    key = asciiKey;
                    console.log("Key built from array of decimal numbers (as ASCII):", key);
                } else if (hexKey.length === 128 && /^[0-9a-fA-F]+$/.test(hexKey)) {
                    key = hexKey;
                    console.log("Key built from array of decimal numbers (as HEX):", key);
                } else {
                    console.error("Array of decimal numbers found, but neither ASCII nor HEX version is valid.");
                    await sendErrorEmail("Array of decimal numbers found, but neither ASCII nor HEX version is valid.");
                    process.exit(1);
                }
            } else {
                // Otherwise, search for the arrays as before (legacy logic)
                const rMatch = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*\[([^\]]+)\];/g);
                let rArray = null, aArray = null;

                for (const m of rMatch || []) {
                    if (/"[\da-f]+"/.test(m) && m.split(',').length > 10) {
                        if (!rArray) rArray = m;
                    } else if (/(\d+, *){3,}/.test(m)) {
                        if (!aArray) aArray = m;
                    }
                }

                if (!rArray || !aArray) {
                    console.error("Could not find the arrays or direct variable.");
                    await sendErrorEmail("Could not find the arrays or direct variable.");
                    process.exit(1);
                }

                const rValues = JSON.parse(rArray.replace(/^[^\[]*\[/, '[').replace(/;$/, ''));
                const aValues = JSON.parse(aArray.replace(/^[^\[]*\[/, '[').replace(/;$/, ''));

                key = aValues.map(n => rValues[n]).join('');
                
                console.log("Key reconstructed (legacy method):", key);
            }            
        }
    }

    // Validate the key
    const isValidKey = (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) || ((key.length === 64 || key.length === 128) && /^[0-9a-fA-F]+$/.test(key));

    if (!isValidKey) {
        console.error("The generated key is NOT valid. The file will not be saved.");
        await sendErrorEmail();
        process.exit(1);
    }

    // Set output key file location
    const keyFile = path.join(outputDir, 'key.json');

    // Try reading the existing file to compare
    let lastKey = null;
    let lastModifiedAt = null;
    let elapsedSeconds = null;
    let previousModifiedAt = null;

    try {
        if (fs.existsSync(keyFile)) {
            const previous = JSON.parse(fs.readFileSync(keyFile, 'utf-8'));
            lastKey = previous.decryptKey;
            lastModifiedAt = previous.modifiedAt;
            previousModifiedAt = previous.modifiedAt;
        }
    } catch (err) {
        lastKey = null;
        lastModifiedAt = null;
        previousModifiedAt = null;
    }

    // If the key did NOT change, exit without saving
    if (lastKey === key) {
        console.log('The key has not changed, the file will not be updated.');
        process.exit(0);
    }

    // Calculate elapsed time in seconds
    if (lastModifiedAt) {
        try {
            const lastDate = new Date(lastModifiedAt).getTime();
            const now = Date.now();
            if (!isNaN(lastDate)) {
                elapsedSeconds = Math.floor((now - lastDate) / 1000);
            }
        } catch (err) {
            elapsedSeconds = null;
        }
    }

    // Create the output JSON
    const result = {
        decryptKey: key,
        modifiedAt: new Date().toISOString(),
        previousModifiedAt,
        elapsedSeconds
    };

    fs.writeFileSync(keyFile, JSON.stringify(result, null, 2), 'utf-8');

    console.log('key.json file created successfully.');

    console.log('Previous date:', previousModifiedAt);

    console.log('Time since last generation:', elapsedSeconds, 'seconds');

    await sendNewKeyEmail(
        key,
        [
            `Previous key: ${lastKey || 'none'}`,
            `Time since last: ${elapsedSeconds ?? 'unknown'} seconds.`,
            `You can check the latest file here:`,
            `https://raw.githubusercontent.com/carlosesteven/e1-player-deobf/main/output/key.json`,
            `See full commit history:`,
            `https://github.com/carlosesteven/e1-player-deobf/commits/main/output/key.json`
        ].join('\n\n')
    );
}

main();