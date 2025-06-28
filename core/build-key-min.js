import fs from 'fs';
import path from 'path';
import { sendErrorEmail, sendNewKeyEmail } from './send-email.js';
import { getSources, tryDecryptWithKeyOrReverse } from './utils.js';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

async function main() {
    const __filename = fileURLToPath(import.meta.url);

    const __dirname = path.dirname(__filename);

    const repoRoot = path.resolve(__dirname, '..'); 

    const outputDir = path.join(repoRoot, 'output');

    const keyFile = path.join(outputDir, 'key.json');

    const aiMarkerFile = path.join(outputDir, 'ai-last-run.json');

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
    
        const checkString = await getSources();

        let result = tryDecryptWithKeyOrReverse(checkString, keyTemp);
    
        if (result) {
            key = result.keyUsed;
            if (lastKey === keyTemp) {
                console.log('\n\nThe key has not changed, but it is still valid. No update needed.\n\n');
                process.exit(0);
            }
        } else {
            if (lastKey === keyTemp) {
                console.log('\n\nThe key has not changed, but it is NO LONGER valid. Attempting fallback.\n\n');
            }
    
            try {
                const altKeyResponse = await fetch("https://raw.githubusercontent.com/itzzzme/megacloud-keys/main/key.txt?v=" + Date.now());

                const altKeyText = await altKeyResponse.text();
                
                const altKey = altKeyText.trim();
    
                console.log("\n\nTrying alternative key:", altKey);
    
                let altResult = tryDecryptWithKeyOrReverse(checkString, altKey);
    
                if (altResult) {
                    key = altResult.keyUsed;
                } else {
                    console.log('\n\nNo valid key found in either source.');
                    process.exit(0);
                }
            } catch (altErr) {            
                console.error("Could not test with external key:", altErr);
                await sendErrorEmail();
                process.exit(0);
            }
        }
    } catch (extErr) {            
        console.error("Could not test with external key:", extErr);
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

        let lastRun = 0;
        
        if (fs.existsSync(aiMarkerFile)) {
            try {
                const info = JSON.parse(fs.readFileSync(aiMarkerFile, 'utf8'));
                lastRun = new Date(info.lastRun).getTime();
            } catch {}
        }

        const now = Date.now();

        const HALF_HOUR = 30 * 60 * 1000; // 30 minutos en milisegundos

        if (now - lastRun < HALF_HOUR) {
            console.log("\n\nAI backup was already run less than 30 minutes ago. Skipping AI execution.");
            process.exit(0); 
        }else{
            fs.writeFileSync(aiMarkerFile, JSON.stringify({ lastRun: new Date().toISOString() }), 'utf-8');
        }

        try {
            execSync('node core/build-key-ai.js', { stdio: 'inherit' });
        } catch (err) {
            console.error("\n\nAI BACKUP SCRIPT FAILED!", err);
            process.exit(1);
        }
    }
}

main();