import fs from "fs";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import 'dotenv/config';

const API_KEY = process.env.API_KEY;

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

const execAsync = promisify(exec);

const writeFileAsync = promisify(fs.writeFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputDir = path.join(repoRoot, 'output');
const inputFile = path.join(outputDir, 'input.txt');
const outputFile = path.join(outputDir, 'output.js');
const keyFile = path.join(outputDir, 'key.json');
const aiMarkerFile = path.join(outputDir, 'ai-last-run.json');

async function generateContent(prompt) {
  try {
    const response = await axios.post(API_URL, {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    });
    return response.data.candidates[0]?.content?.parts[0]?.text.trim();
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function main() {
  try {
    // Por si lanzas este script fuera de la raíz
    process.chdir(repoRoot);

    console.log("Fetching script...");
    const response = await axios.get(
      "https://megacloud.blog/js/player/a/v2/pro/embed-1.min.js?v=" + Date.now()
    );
    console.log("Received script.");

    await writeFileAsync(inputFile, response.data, "utf8");
    console.log("input.txt successfully written.");

    console.log("Running deobfuscate.js...");

    await execAsync("node core/deobfuscate.js");

    console.log("deobfuscate.js finished.");

    console.log("Reading output.js...");

    const data = await fs.promises.readFile(outputFile, "utf8");

    const match = data.match(/\(\(\)\s*=>\s*\{([\s\S]*?)try\s*{/);

    if (!match) {
      console.error("!No match found!");
      return;
    }
    console.log(match[0]);

    const extra_message =
      "Decode the following obfuscated script, extract, and retain only the relevant code that directly generates the 64-bit secret key. Remove all irrelevant, unused, or undefined code — keep just the cleaned-up JavaScript that performs the key generation. The cleaned-up script should be self-contained and functional, with the last line printing the generated key (using console.log), and do not wrap it inside any function. Do not include comments, explanations, or additional fluff — output code only.";
    const prompt = match[0] + "\n" + extra_message;

    console.log("Waiting for LLM response.");
    const decoded_code = await generateContent(prompt);

    if (!decoded_code) {
      console.error("No code returned from LLM.");
      return;
    }
    console.log(decoded_code);

    const lines = decoded_code.split("\n");
    const startsWithFence = lines[0]?.trim().startsWith("```javascript");
    const endsWithFence = lines[lines.length - 1]?.trim() === "```";
    const final_code = (
      startsWithFence && endsWithFence ? lines.slice(1, -1) : lines
    )
      .join("\n")
      .replace("console.log", "return");

    let finalKey = new Function(final_code)();

    console.log("\nFinal key is: ");

    console.log(finalKey + "\n");

    if (typeof finalKey !== "string" || !/^[0-9a-fA-F]{64}$/.test(finalKey)) {
      console.error("Extracted key is not a valid 64-char hex string. Not saving.");
      return;
    }

    let lastKey = null;
    let lastModifiedAt = null;
    let previousModifiedAt = null;
    let elapsedSeconds = null;

    try {
        if (fs.existsSync(keyFile)) {
            const previous = JSON.parse(fs.readFileSync(keyFile, 'utf-8'));
            lastKey = previous.decryptKey;
            lastModifiedAt = previous.modifiedAt;
            previousModifiedAt = previous.modifiedAt;
        }
    } catch (err) {}

    if (lastKey === finalKey) {
        console.log('The key has not changed, the file will not be updated.');
        return;
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
        decryptKey: finalKey,
        modifiedAt: new Date().toISOString(),
        previousModifiedAt,
        elapsedSeconds
    };

    fs.writeFileSync(keyFile, JSON.stringify(result, null, 2), 'utf-8');    
    
    fs.writeFileSync(aiMarkerFile, JSON.stringify({ lastRun: new Date().toISOString() }), 'utf-8');

    console.log('Key successfully written to key.json.');

    console.log('AI marker file updated:', aiMarkerFile);

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
  } catch (error) {
    console.error("Error in main.", error);
  }
}

main()
  .then()
  .catch((error) => console.error(error));