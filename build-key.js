import fs from 'fs';

// Lee el archivo
const code = fs.readFileSync('output.js', 'utf-8');

// Busca los arrays K y n usando regex (soporta nombres K/k/r, n/a)
const rMatch = code.match(/([a-zA-Z_$][\w$]*)\s*=\s*\[([^\]]+)\];/g);
let rArray = null, aArray = null;

// Busca la sección correcta (con valores tipo "542", "e3"... y enteros)
for (const m of rMatch) {
    if (/"[\da-f]+"/.test(m) && m.split(',').length > 10) {
        if (!rArray) rArray = m;
    } else if (/(\d+, *){3,}/.test(m)) {
        if (!aArray) aArray = m;
    }
}

// Extrae los arrays
if (!rArray || !aArray) {
    console.error("No se encontraron los arrays.");
    process.exit(1);
}

const rValues = JSON.parse(rArray.replace(/^[^\[]*\[/, '[').replace(/;$/, ''));
const aValues = JSON.parse(aArray.replace(/^[^\[]*\[/, '[').replace(/;$/, ''));

// Construye la key
const key = aValues.map(n => rValues[n]).join('');

console.log("Key:", key);
console.log("Length:", key.length);

// Crea el JSON de salida
const result = {
    megacloud: key,
    modifiedAt: new Date().toISOString(),
};

fs.writeFileSync('key.json', JSON.stringify(result, null, 2), 'utf-8');

console.log('Archivo megacloud-key.json creado.');