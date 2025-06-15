import 'dotenv/config';

import nodemailer from 'nodemailer';

export async function sendErrorEmail(mensajeExtra = '') {
    const correo_remitente = process.env.MAIL_USER;
    const password_remitente = process.env.MAIL_PASS;
    const correo_destinatario = process.env.MAIL_TO.split(/[,;]/).map(e => e.trim()).filter(Boolean);
    const host_correo = process.env.MAIL_HOST;
    const hora = new Date().toLocaleString('en-US', { hour12: false, timeZone: 'America/Bogota' });

    const transporter = nodemailer.createTransport({
        host: host_correo,
        port: 587,
        secure: false, // STARTTLS
        auth: {
            user: correo_remitente,
            pass: password_remitente
        }
        // No es necesario tls: { ciphers: ... }
    });

    const mailOptions = {
        from: `"Support CSC LAB" <${correo_remitente}>`,
        to: correo_destinatario,
        subject: `E1 Player Deobfuscator: Failed to find key at ${hora}`,
        text: `There was an error: The key could not be found.\n\nTime of incident: ${hora}\n\n${mensajeExtra}\n\nPlease check the extractor immediately.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Error notification email sent.');
    } catch (error) {
        console.error('Error sending email:', error);
    }
}