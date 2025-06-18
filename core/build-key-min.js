import fs from 'fs';
import path from 'path';
import { sendErrorEmail, sendNewKeyEmail } from './send-email.js';
import { getSources, tryDecryptWithKeyOrReverse } from './utils.js';
import { fileURLToPath } from 'url';

async function main() {
    const __filename = fileURLToPath(import.meta.url);

    const __dirname = path.dirname(__filename);

    const repoRoot = path.resolve(__dirname, '..'); 

    const outputDir = path.join(repoRoot, 'output');

    const keyFile = path.join(outputDir, 'key.json');

    let key = null;

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
        }
    } catch (extErr) {            
        console.error("No fue posible probar con key externa:", extErr);

        await sendErrorEmail();

        process.exit(0);
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

    if (typeof key === 'string' && key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
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
    }else{
        console.log('\n\nNo valid key to write. Nothing was updated.');
    }
}

main();