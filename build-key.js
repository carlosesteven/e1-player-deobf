import fs from 'fs';

// Lee el archivo de JS desofuscado
const code = fs.readFileSync('output.js', 'utf-8');

// Busca los arrays tipo r/K y a/n
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
    console.error("No se encontraron los arrays.");
    process.exit(1);
}

const rValues = JSON.parse(rArray.replace(/^[^\[]*\[/, '[').replace(/;$/, ''));
const aValues = JSON.parse(aArray.replace(/^[^\[]*\[/, '[').replace(/;$/, ''));

const key = aValues.map(n => rValues[n]).join('');
console.log("Key:", key);
console.log("Length:", key.length);

const isValidKey = key.length === 64 && /^[0-9a-fA-F]+$/.test(key);

if (!isValidKey) {
    console.error("La key generada NO es válida. No se guardará el archivo.");
    process.exit(1);
}

// Intenta leer el archivo existente para comparar
let lastKey = null;
let lastModifiedAt = null;
let elapsedSeconds = null;
let previousModifiedAt = null;

try {
    if (fs.existsSync('key.json')) {
        const previous = JSON.parse(fs.readFileSync('key.json', 'utf-8'));
        lastKey = previous.megacloud;
        lastModifiedAt = previous.modifiedAt;
        previousModifiedAt = previous.modifiedAt;
    }
} catch (err) {
    lastKey = null;
    lastModifiedAt = null;
    previousModifiedAt = null;
}

// Si la key NO cambió, salir sin guardar
if (lastKey === key) {
    console.log('La key no cambió, no se actualizará el archivo.');
    process.exit(0);
}

// Calcula tiempo transcurrido en segundos
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

// Crea el JSON de salida
const result = {
    megacloud: key,
    modifiedAt: new Date().toISOString(),
    previousModifiedAt,
    elapsedSeconds
};

fs.writeFileSync('key.json', JSON.stringify(result, null, 2), 'utf-8');
console.log('Archivo key.json creado correctamente.');
console.log('Fecha anterior:', previousModifiedAt);
console.log('Tiempo desde la última generación:', elapsedSeconds, 'segundos');