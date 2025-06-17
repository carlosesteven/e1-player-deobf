import CryptoJS from 'crypto-js';
const asciiKey = "HMMIJIIOONNOIINOINNIN"; // lo que sale del array
const realKey = CryptoJS.SHA256(asciiKey).toString(); // <-- esto da tu key de 64 hex chars
console.log(realKey); // debería dar: 7a13da6aef315451e308e58c8c8b73c653bc1e0935e04808bc520eb360be7fb9