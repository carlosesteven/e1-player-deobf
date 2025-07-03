import fs from 'fs';
import path from 'path';
import { sendErrorEmail, sendNewKeyEmail } from './send-email.js';
import { getSources, tryDecryptWithKeyOrReverse } from './utils.js';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import CryptoJS from 'crypto-js';

async function main() {
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
            console.log("\n\nKey found directly:", key);

            const checkString = await getSources();

            console.log("\n\ncheckString found:", checkString);

            let decrypted, plaintext, parsed;

            try {
                decrypted = CryptoJS.AES.decrypt(checkString, key);
                plaintext = decrypted.toString(CryptoJS.enc.Utf8);
                parsed = JSON.parse(plaintext);
                console.log("\n\nSuccess with direct key:", key);                
            } catch (err) {
                const reversedKey = key.split('').reverse().join('');
                try {
                    decrypted = CryptoJS.AES.decrypt(checkString, reversedKey);
                    plaintext = decrypted.toString(CryptoJS.enc.Utf8);
                    parsed = JSON.parse(plaintext);
                    key = reversedKey; 
                    console.log("\n\nSuccess with reversed key:", key);
                } catch (err2) {
                    console.log("\n\nFailed to decrypt with both direct and reversed key.");
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
                if (/^[\da-fA-F]{64}$/.test(ascii)) {
                    key = ascii;
                    console.log("\n\nKey found as base64 (decoded as ASCII/hex):", key);
                } else {
                    const hex = Buffer.from(possibleKey, 'base64').toString('hex');
                    const asciiFromHex = Buffer.from(hex, 'hex').toString('ascii');                    
                    if (/^[\da-fA-F]{64}$/.test(asciiFromHex)) {
                        key = asciiFromHex;
                        console.log("\n\nKey found as base64 (decoded as HEX→ASCII):", key);
                    } else if (hex.length === 128) {
                        key = hex;
                        console.log("\n\nKey found as base64 and converted to 128-char hex:", key);
                    }
                }
            } catch (e) {
                decoded = null;
            }
        }else if (arrayMatch) {
            const hexStrings = arrayMatch[0].match(/"([0-9a-fA-F]{2})"/g).map(s => s.replace(/"/g, ''));
            const asciiKey = hexStrings.map(h => String.fromCharCode(parseInt(h, 16))).join('');
            const hexKey = hexStrings.join('');
            if (/^[\x20-\x7E]{64}$/.test(asciiKey)) { 
                key = asciiKey;
                console.log("\n\nKey built from array of hex strings (as ASCII):", key);
            } else if (hexKey.length === 128 && /^[0-9a-fA-F]+$/.test(hexKey)) {
                key = hexKey;
                console.log("\n\nKey built from array of hex strings (as HEX):", key);
            } else {
                console.error("\n\nArray of hex strings found, but neither ASCII nor HEX version is valid.");
                //await sendErrorEmail("Array of hex strings found, but neither ASCII nor HEX version is valid.");
            }
        } else {
            const decimalArrayMatch = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*\[((?:\d+,?\s*){64})\]/);
            if (decimalArrayMatch) {
                const decNumbers = decimalArrayMatch[0].match(/\d+/g).map(Number);
                const asciiKey = decNumbers.map(n => String.fromCharCode(n)).join('');
                const hexKey = decNumbers.map(n => n.toString(16).padStart(2, '0')).join('');

                if (/^[\x20-\x7E]{64}$/.test(asciiKey)) {
                    key = asciiKey;
                    console.log("\n\nKey built from array of decimal numbers (as ASCII):", key);
                } else if (hexKey.length === 128 && /^[0-9a-fA-F]+$/.test(hexKey)) {
                    key = hexKey;                    
                    console.log("\n\nKey built from array of decimal numbers (as HEX):", key);
                } else {
                    console.error("\n\nArray of decimal numbers found, but neither ASCII nor HEX version is valid.");
                    //await sendErrorEmail("Array of decimal numbers found, but neither ASCII nor HEX version is valid.");
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
                    console.error("\n\nCould not find the arrays or direct variable.");
                    //await sendErrorEmail("Could not find the arrays or direct variable.");                    
                }else{
                    const rValues = JSON.parse(rArray.replace(/^[^\[]*\[/, '[').replace(/;$/, ''));

                    const aValues = JSON.parse(aArray.replace(/^[^\[]*\[/, '[').replace(/;$/, ''));

                    key = aValues.map(n => rValues[n]).join('');
                    
                    console.log("\n\nKey reconstructed (legacy method):", key);
                }
            }            
        }
    }

    if (typeof key === 'string' && key.length === 128 && /^[0-9a-fA-F]{128}$/.test(key)) {
        const asciiKey = Buffer.from(key, "hex").toString("ascii");
        if (/^[0-9a-fA-F]{64}$/.test(asciiKey)) {
            key = asciiKey;
            console.log("\n\nConverted 128-hex to 64-char key:", key);
        }
    }

    const isValidKey = typeof key === 'string' && key.length === 64 && /^[0-9a-fA-F]+$/.test(key);

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


    if (!isValidKey) {
        console.error("\n\nThe generated key is NOT valid. The file will not be saved.");
        try {
            const keyResponse = await fetch("https://raw.githubusercontent.com/yogesh-hacker/MegacloudKeys/main/keys.json?v=" + Date.now());

            const keyJson = await keyResponse.json();

            const keyTemp = keyJson.mega;

            console.log("\n\nExternal key:", keyTemp);

            if (lastKey === keyTemp) {
                console.log('\n\nThe key has not changed, the file will not be updated.\n\n');
                process.exit(0);
            }            
        
            const checkString = await getSources();
        
            const result = tryDecryptWithKeyOrReverse(checkString, keyTemp);

            if (result) {
                key = result.keyUsed;
            } else {
                const altKeyResponse = await fetch("https://raw.githubusercontent.com/itzzzme/megacloud-keys/main/key.txt?v=" + Date.now());

                const altKeyText = await altKeyResponse.text();

                const altKey = altKeyText.trim();

                console.log("\n\nTrying with backup external key:", altKey);

                if (lastKey === altKey) {
                    console.log('\n\nThe key has not changed, the file will not be updated.\n\n');
                    process.exit(0);
                }            
                        
                const result = tryDecryptWithKeyOrReverse(checkString, altKey);

                if (result) {
                    key = result.keyUsed;
                } else {
                    console.log('\n\nCould not decrypt with either the direct or reversed key.');
                }
            }
        } catch (extErr) {            
            console.error("Could not try with external key:", extErr);

            await sendErrorEmail("Could not find the arrays or direct variable.");             

            let lastRun = 0;

            if (fs.existsSync(aiMarkerFile)) {
                try {
                    const info = JSON.parse(fs.readFileSync(aiMarkerFile, 'utf8'));
                    lastRun = new Date(info.lastRun).getTime();
                } catch {}
            }

            const now = Date.now();

            const HALF_HOUR = 30 * 60 * 1000;

            if (now - lastRun < HALF_HOUR) {
                console.log("\n\nAI backup was already run less than 30 minutes ago. Skipping AI execution.");
                process.exit(0); 
            }

            try {
                execSync('node core/build-key-ai.js', { stdio: 'inherit' });
            } catch (err) {
                console.error("\n\nAI BACKUP SCRIPT FAILED!", err);
                process.exit(1);
            }

            process.exit(0);
        }
    }

    if (lastKey === key) {
        console.log('\n\nThe key has not changed, the file will not be updated.\n\n');
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

    if (!(typeof key === 'string' && key.length === 64 && /^[0-9a-fA-F]+$/.test(key))) {
        console.error("\n\nAttempted to save invalid key:", key);
        process.exit(1);
    }

    const result = {
        decryptKey: key,
        modifiedAt: new Date().toISOString(),
        previousModifiedAt,
        elapsedSeconds
    };

    fs.writeFileSync(keyFile, JSON.stringify(result, null, 2), 'utf-8');

    console.log('\n\nkey.json file created successfully.');

    console.log('\n\nPrevious date:', previousModifiedAt);

    console.log('\n\nTime since last generation:', elapsedSeconds, 'seconds\n\n');

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