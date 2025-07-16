import CryptoJS from 'crypto-js';

export async function getSources() {
    const resource = await fetch('https://hianime.to/ajax/v2/episode/sources?id=437666');

    // We check if the type is iframe
    const resourceData = await resource.json();
    if (resourceData.type !== 'iframe') {
        console.error('[!] Resource type is not iframe:', resourceData);
        process.exit(1);
    }

    // We Extract domain & ID from the link https://{domain}/embed-2/v2/e-1/{id}?k=1
    const link = resourceData.link;
    const resourceLinkMatch = link.match(/https:\/\/([^/]+)\/embed-2\/(v2|v3)\/e-1\/([^?]+)/);
    if (!resourceLinkMatch) 
    {
        console.error('[!] Failed to extract domain and ID from link:', resourceData);
        process.exit(1);
    }
    
    const domain = resourceLinkMatch[1];
    const version = resourceLinkMatch[2]; // 'v2' o 'v3'
    const id = resourceLinkMatch[3];

    const resp = await fetch("https://" + domain + "/embed-2/" + version + "/e-1/getSources?id=" + id, { 
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

export function tryDecryptWithKeyOrReverse(checkString, keyCandidate) {
    let decrypted, plaintext;
    try {
        decrypted = CryptoJS.AES.decrypt(checkString, keyCandidate);
        plaintext = decrypted.toString(CryptoJS.enc.Utf8);
        if (!plaintext) throw new Error("Empty plaintext");
        JSON.parse(plaintext); // will throw if not JSON
        console.log("\n\nSuccess with external key:", keyCandidate);
        return { decrypted, keyUsed: keyCandidate, reversed: false };
    } catch (err) {
        const reversedKey = keyCandidate.split('').reverse().join('');
        try {
            decrypted = CryptoJS.AES.decrypt(checkString, reversedKey);
            plaintext = decrypted.toString(CryptoJS.enc.Utf8);
            if (!plaintext) throw new Error("Empty plaintext");
            JSON.parse(plaintext);
            console.log("\n\nSuccess with reversed external key:", reversedKey);
            return { decrypted, keyUsed: reversedKey, reversed: true };
        } catch (err2) {
            console.log("\n\nFailed to decrypt with either the direct or reversed key.");
            return null;
        }
    }
}