import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transport = null;

export const mailConfigured = () => !!(env.SMTP_HOST && env.SMTP_FROM);

const escHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const htmlFromText = (text) =>
  `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.55;color:#1e1b3a">${escHtml(text).replace(/\n/g, '<br>')}</div>`;

function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_SECURE === 'true',
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text }) {
  if (!mailConfigured()) {
    throw new Error('Email is not set up on the server. Add SMTP_HOST and SMTP_FROM to backend/.env and restart.');
  }
  try {
    await getTransport().sendMail({
      from: env.SMTP_FROM,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: String(subject).replace(/\s+/g, ' ').slice(0, 200),
      text,
      html: htmlFromText(text),
    });
  } catch (e) {
    throw new Error(`Could not send the email: ${String(e.message).slice(0, 160)}`);
  }
}