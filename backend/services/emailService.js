const nodemailer = require('nodemailer');

const hasSmtpConfig = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.FROM_EMAIL);

const dns = require('dns');

// Force IPv4 DNS resolution — prevents ENETUNREACH when Gmail resolves to IPv6
dns.setDefaultResultOrder('ipv4first');

const getTransporter = () => {
  if (!hasSmtpConfig()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: String(process.env.SMTP_PORT) === '465',
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    dnsOptions: { family: 4 },
    tls: { rejectUnauthorized: false },
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendEmail = async ({ to, subject, html }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`SMTP is not configured. Skipping email to ${to}: ${subject}`);
    return { skipped: true };
  }

  const info = await transporter.sendMail({
    from: `"${process.env.FROM_NAME || 'MockMate'}" <${process.env.FROM_EMAIL}>`,
    to,
    subject,
    html,
  });
  console.log(`Email sent to ${to}: ${info.messageId}`);
  return info;
};

const getVerificationEmailTemplate = (name, token, clientUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;border:1px solid rgba(139,92,246,0.3);">
    <div style="background:linear-gradient(135deg,#14b8a6,#0d9488);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">MockMate</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#e2e8f0;margin-top:0;">Welcome, ${name}.</h2>
      <p style="color:#94a3b8;line-height:1.6;">Please verify your email to activate your MockMate account.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${clientUrl}/verify-email/${token}" style="background:linear-gradient(135deg,#14b8a6,#0d9488);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;display:inline-block;">Verify Email Address</a>
      </div>
      <p style="color:#64748b;font-size:13px;">This link expires in 24 hours. If you did not create an account, ignore this email.</p>
    </div>
  </div>
</body>
</html>
`;

const getPasswordResetTemplate = (name, token, clientUrl) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;border:1px solid rgba(139,92,246,0.3);">
    <div style="background:linear-gradient(135deg,#14b8a6,#0d9488);padding:32px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Password Reset</h1></div>
    <div style="padding:32px;">
      <h2 style="color:#e2e8f0;margin-top:0;">Hi ${name},</h2>
      <p style="color:#94a3b8;line-height:1.6;">Click the button below to set a new password.</p>
      <div style="text-align:center;margin:32px 0;"><a href="${clientUrl}/reset-password/${token}" style="background:linear-gradient(135deg,#14b8a6,#0d9488);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;display:inline-block;">Reset Password</a></div>
      <p style="color:#64748b;font-size:13px;">This link expires in 1 hour.</p>
    </div>
  </div>
</body>
</html>
`;

const getInterviewReadyTemplate = (name, role) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;border:1px solid rgba(139,92,246,0.3);">
    <div style="background:linear-gradient(135deg,#059669,#0d9488);padding:32px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">Interview Complete</h1></div>
    <div style="padding:32px;">
      <h2 style="color:#e2e8f0;margin-top:0;">Great job, ${name}.</h2>
      <p style="color:#94a3b8;line-height:1.6;">Your <strong style="color:#a78bfa;">${role}</strong> mock interview is complete. Your feedback report and transcript are ready to review.</p>
    </div>
  </div>
</body>
</html>
`;

const getRecordingNotificationTemplate = (name, interviewId, clientUrl) => `
<p>Hi ${name},</p>
<p>Your MockMate interview recording is available for 24 hours.</p>
<p><a href="${clientUrl}/interview/${interviewId}/feedback">Open feedback and recording options</a></p>
`;

const getReminderTemplate = (name, interviewId, clientUrl) => `
<p>Hi ${name},</p>
<p>Your interview recording will expire soon. Unlock it before the 24 hour window ends.</p>
<p><a href="${clientUrl}/interview/${interviewId}/feedback">Open recording options</a></p>
`;

const sendVerificationEmail = (user) => sendEmail({
  to: user.email,
  subject: 'Verify your MockMate email',
  html: getVerificationEmailTemplate(user.name, user.verificationToken, process.env.CLIENT_URL || 'http://localhost:3000'),
});

const sendRecordingNotification = async (userId, interviewId) => {
  const User = require('../models/User');
  const user = await User.findById(userId);
  if (!user) return null;
  return sendEmail({
    to: user.email,
    subject: 'Your MockMate recording is available',
    html: getRecordingNotificationTemplate(user.name, interviewId, process.env.CLIENT_URL || 'http://localhost:3000'),
  });
};

const sendReminderEmail = (user, interview) => sendEmail({
  to: user.email,
  subject: 'Your MockMate recording expires soon',
  html: getReminderTemplate(user.name, interview._id, process.env.CLIENT_URL || 'http://localhost:3000'),
});

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendRecordingNotification,
  sendReminderEmail,
  getVerificationEmailTemplate,
  getPasswordResetTemplate,
  getInterviewReadyTemplate,
};
