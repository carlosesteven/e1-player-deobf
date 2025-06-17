import fs from 'fs';
import path from 'path';
import { sendErrorEmail, sendNewKeyEmail } from './send-email.js';
import { fileURLToPath } from 'url';
import CryptoJS from 'crypto-js';

async function main() {
    async function getSources() {
        const resp = await fetch("https://megacloud.blog/embed-2/v2/e-1/getSources?id=kzZeFJupBAvW", {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36',
                Referer: "http://hianime.to",
                'X-Requested-With': 'XMLHttpRequest',
            },
            method: 'GET',
            mode: 'cors',
        });
    
        if (!resp.ok) {
            throw new Error(`Request failed: ${resp.status}`);
        }
    
        const data = await resp.json();
        if (data && data.sources) {
            return data.sources; 
        } else {
            throw new Error('No sources found!');
        }
    }

    const __filename = fileURLToPath(import.meta.url);

    const __dirname = path.dirname(__filename);

    const repoRoot = path.resolve(__dirname, '..'); 

    const outputDir = path.join(repoRoot, 'output');

    const keyFile = path.join(outputDir, 'key.json');

    const code = fs.readFileSync(path.join(outputDir, 'output.js'), 'utf-8');

    const aiMarkerFile = path.join(outputDir, 'ai-last-run.json');

    const keyMatch = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*["'`]-*([0-9a-fA-F]{64})-*["'`]/);

    let key = null;

    if (keyMatch) {
        key = keyMatch[2];
        let lastKeyTemp = null;
        try {
            if (fs.existsSync(keyFile)) {
                const previous = JSON.parse(fs.readFileSync(keyFile, 'utf-8'));
                lastKeyTemp = previous.decryptKey;
            }
        } catch (err) {
            lastKeyTemp = null;
        }
        const reversedKey = key.split('').reverse().join('');
        if (lastKeyTemp && (key === lastKeyTemp || reversedKey === lastKeyTemp)) {
            key = lastKeyTemp;
        }else{
            console.log("Key found directly:", key);
            const checkString = await getSources();
            console.log("checkString found:", checkString);
            let decrypted, plaintext, parsed;
            try {
                decrypted = CryptoJS.AES.decrypt(checkString, key);
                plaintext = decrypted.toString(CryptoJS.enc.Utf8);
                parsed = JSON.parse(plaintext);
                console.log("Success with direct key:", key);                
            } catch (err) {
                const reversedKey = key.split('').reverse().join('');
                try {
                    decrypted = CryptoJS.AES.decrypt(checkString, reversedKey);
                    plaintext = decrypted.toString(CryptoJS.enc.Utf8);
                    parsed = JSON.parse(plaintext);
                    key = reversedKey; // <-- ¡AQUÍ! ahora key tiene la buena
                    console.log("Success with reversed key:", key);
                } catch (err2) {
                    console.log("Failed to decrypt with both direct and reversed key.");
                    process.exit(1);
                }
            }
        }
    }else {
        const arrayMatch = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*\[((?:"[0-9a-fA-F]{2}",?\s*){64})\]/);

        const base64Match = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*["'`]([A-Za-z0-9+/=]{86,89})["'`]/);

        if (base64Match) {
            const possibleKey = base64Match[2];
            let decoded = null;
            try {
                const ascii = Buffer.from(possibleKey, 'base64').toString('ascii');
                console.log("");
                console.log("");
                if (/^[\da-fA-F]{64}$/.test(ascii)) {
                    key = ascii;
                    console.log("Key found as base64 (decoded as ASCII/hex):", key);
                } else {
                    const hex = Buffer.from(possibleKey, 'base64').toString('hex');
                    const asciiFromHex = Buffer.from(hex, 'hex').toString('ascii');                    
                    if (/^[\da-fA-F]{64}$/.test(asciiFromHex)) {
                        key = asciiFromHex;
                        console.log("Key found as base64 (decoded as HEX→ASCII):", key);
                    } else if (hex.length === 128) {
                        key = hex;
                        console.log("Key found as base64 and converted to 128-char hex:", key);
                    }
                }
            } catch (e) {
                decoded = null;
            }
        }else if (arrayMatch) {
            const hexStrings = arrayMatch[0].match(/"([0-9a-fA-F]{2})"/g).map(s => s.replace(/"/g, ''));
            const asciiKey = hexStrings.map(h => String.fromCharCode(parseInt(h, 16))).join('');
            const hexKey = hexStrings.join('');
        
            if (/^[\x20-\x7E]{64}$/.test(asciiKey)) { // 64 caracteres ASCII imprimibles
                key = asciiKey;
                console.log("");
                console.log("");
                console.log("Key built from array of hex strings (as ASCII):", key);
            } else if (hexKey.length === 128 && /^[0-9a-fA-F]+$/.test(hexKey)) {
                key = hexKey;
                console.log("");
                console.log("");
                console.log("Key built from array of hex strings (as HEX):", key);
            } else {
                console.log("");
                console.log("");
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

                console.log("");
                console.log("");

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
                
                console.log("");
                console.log("");
                console.log("Key reconstructed (legacy method):", key);
            }            
        }
    }

    if (key && key.length === 128 && /^[0-9a-fA-F]{128}$/.test(key)) {
        const asciiKey = Buffer.from(key, "hex").toString("ascii");
        if (/^[0-9a-fA-F]{64}$/.test(asciiKey)) {
            key = asciiKey;
            console.log("");
            console.log("");
            console.log("Converted 128-hex to 64-char key:", key);
        }
    }

    const isValidKey = key.length === 64 && /^[0-9a-fA-F]+$/.test(key);

    if (!isValidKey) {
        console.error("The generated key is NOT valid. The file will not be saved.");

        await sendErrorEmail();

        let lastRun = 0;
        if (fs.existsSync(aiMarkerFile)) {
            try {
                const info = JSON.parse(fs.readFileSync(aiMarkerFile, 'utf8'));
                lastRun = new Date(info.lastRun).getTime();
            } catch {}
        }

        const now = Date.now();

        const HOUR = 60 * 60 * 1000;

        if (now - lastRun < HOUR) {
            console.log("");
            console.log("");
            console.log("AI backup was already run less than 1 hour ago. Skipping AI execution.");
            process.exit(0); 
        }

        try {
            execSync('node core/build-key-ai.js', { stdio: 'inherit' });
        } catch (err) {
            console.log("");
            console.log("");
            console.error("AI BACKUP SCRIPT FAILED!", err);
            process.exit(1);
        }

        process.exit(0);
    }

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

    if (lastKey === key) {
        console.log("");
        console.log("");
        console.log('The key has not changed, the file will not be updated.');
        process.exit(0);
    }

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

    const result = {
        decryptKey: key,
        modifiedAt: new Date().toISOString(),
        previousModifiedAt,
        elapsedSeconds
    };

    fs.writeFileSync(keyFile, JSON.stringify(result, null, 2), 'utf-8');

    console.log("");
    console.log("");
    console.log('key.json file created successfully.');
    console.log("");
    console.log("");
    console.log('Previous date:', previousModifiedAt);
    console.log("");
    console.log("");
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