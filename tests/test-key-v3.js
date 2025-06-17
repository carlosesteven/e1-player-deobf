import CryptoJS from 'crypto-js';
const P = atob("c3RQTFpWYTVaczN5bUkwRw==");
const m = "O3vb0t4URszYWGMPp";
const key = CryptoJS.SHA256(P + m).toString();
console.log(key); // ¡Esto sí dará 64 chars hex!