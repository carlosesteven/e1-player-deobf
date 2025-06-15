import 'dotenv/config';
import nodemailer from 'nodemailer';

const correo_remitente = process.env.MAIL_USER;
const password_remitente = process.env.MAIL_PASS;
const correo_destinatario = process.env.MAIL_TO.split(/[,;]/).map(e => e.trim()).filter(Boolean);
const host_correo = process.env.MAIL_HOST;

const hora = new Date().toLocaleString('en-US', { hour12: false, timeZone: 'America/Bogota' });

const transporter = nodemailer.createTransport({
    host: host_correo,
    port: 587,
    secure: false, // STARTTLS, igual que PHPMailer::ENCRYPTION_STARTTLS
    auth: {
        user: correo_remitente,
        pass: password_remitente
    }
});

const mailOptions = {
    from: `"Support CSC LAB" <${correo_remitente}>`,
    to: correo_destinatario,
    subject: `E1 Player Deobfuscator: Failed to find key at ${hora}`,
    text: `There was an error: The key could not be found.\nTime of incident: ${hora}\n\nPlease check the extractor immediately.`,
    // encoding: 'utf-8' // Opcional, nodemailer maneja utf8 por defecto
};

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.error('Error sending email:', error);
    }
    console.log('Error notification email sent:', info.response);
});