const nodemailer = require("nodemailer");

const Mail = async (email, subject, htmlBody, textBody) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"Smart Resume Review" <${process.env.MAIL_USER}>`,
      to: email,
      subject,
      text: textBody,
      html: htmlBody,
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.error("❌ Mail sending failed:", error.message);
    throw new Error("Email could not be sent. Please try again later.");
  }
};

const sendForgotPasswordMail = async (to, username, resetLink) => {
  const subject = `Password Reset Instructions for ${username}`;

  const htmlBody = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Password Reset</title>
    </head>
    <body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f9fafb;padding:20px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
              <tr>
                <td style="padding:24px;text-align:center;">
                  <img src="https://via.placeholder.com/140x40?text=Smart+Resume" alt="Smart Resume Review" width="140" style="margin-bottom:16px;">
                  <h2 style="margin:0;font-size:20px;">Hi ${username},</h2>
                  <p style="font-size:16px;line-height:24px;margin:16px 0;">
                    We received a request to reset your password. Click the button below to create a new one.
                  </p>
                  <p style="margin:20px 0;">
                    <a href="${resetLink}" target="_blank"
                      style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;">
                      Reset Password
                    </a>
                  </p>
                  <p style="font-size:14px;line-height:22px;margin:16px 0;color:#374151;">
                    If the button doesn’t work, copy and paste this link into your browser:
                  </p>
                  <p style="word-break:break-all;font-size:14px;line-height:20px;margin-bottom:24px;">
                    <a href="${resetLink}" style="color:#2563eb;">${resetLink}</a>
                  </p>
                  <p style="font-size:12px;color:#6b7280;">
                    For your security, this link will expire in 30 minutes. If you didn’t request a password reset, please ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background:#f3f4f6;padding:16px;text-align:center;border-radius:0 0 12px 12px;font-size:12px;color:#6b7280;">
                  <p style="margin:4px 0;">Smart Resume Review © ${new Date().getFullYear()}</p>
                  <p style="margin:4px 0;">Need help? <a href="mailto:support@smartresume.com" style="color:#2563eb;">Contact Support</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

  const textBody = `Hi ${username},

We received a request to reset your password.

Reset your password using this link:
${resetLink}

For your security, this link will expire in 30 minutes.
If you didn’t request this, you can safely ignore this email.

— Smart Resume Review Support Team`;

  await Mail(to, subject, htmlBody, textBody);
};

module.exports = { sendForgotPasswordMail };
