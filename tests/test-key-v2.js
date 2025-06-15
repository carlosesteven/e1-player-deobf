import CryptoJS from 'crypto-js';

const encryptedBase64 = "U2FsdGVkX1+STPmmhDYg8iWp7dXqFk111aRlNJbS6H7JmAxWntmjk+ZJZxMmkkCMNaf1sr4DfPXKqspJt6NAEU37C1WTpcnygEQi9rVC5jmNgbQnO9OzpkeJ3Z/XqVP7G3b89nqXDugZYq4w8mnZWf2h2Rce0euI+AUl1Z+OIS4mfbtCgrGKgN77c+Ed9df2rj0aWi3ccOhziRwIfkLZuIXXpGdLdkuYdiWAnhUtTxRiQab0kQF7a4JCJsjN2coQgebrkK8ZbdUEfC1pUb9hXlJ8IFbyX0jC4pUs69ETzv5xhxJhEVt6mIKapo3UKnJyelLBiop1kwYWWouVCc98roUqTFFK27edtzq3eu5ftMB12o1eje/8+XI7Essbd6TDCi1DXIrsHFHRHxlKvZjXsjwI+xvHr8MC6lGkIrZRj0cfhRULWWVhGl+EtEHt6AgPcXrNt6Tnd6DQtRLh2oRhvg=="; // <- tu cadena cifrada base64

const key = "68cec4a8991542ab89cd2922ab21c32959a11e37b81297974cfcd3ffcf6b30b0";

const decrypted = CryptoJS.AES.decrypt(encryptedBase64, key);

try {
    const plaintext = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));

    console.log(plaintext);
    
} catch (err) {
    console.log("JSON NOT VALID");
}