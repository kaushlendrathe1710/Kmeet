import nodemailer from "nodemailer";

// Email transporter configuration
// Will be configured with SMTP credentials from environment variables
let transporter: nodemailer.Transporter | null = null;

export function initializeEmailTransporter() {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn("SMTP credentials not configured. Email functionality will be disabled.");
    return false;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  console.log("Email transporter initialized successfully");
  return true;
}

export function generateOtp(): string {
  // Generate a 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOtpEmail(email: string, otp: string): Promise<boolean> {
  if (!transporter) {
    console.error("Email transporter not initialized");
    return false;
  }

  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

  const mailOptions = {
    from: `"PodcastMeet" <${smtpFrom}>`,
    to: email,
    subject: "Your PodcastMeet Login Code",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="500px" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px 40px 30px;">
                    <h1 style="margin: 0 0 10px; color: #1a1a1a; font-size: 28px; font-weight: 700;">PodcastMeet</h1>
                    <p style="margin: 0; color: #666666; font-size: 14px;">Professional Video Conferencing</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 40px 30px;">
                    <h2 style="margin: 0 0 15px; color: #1a1a1a; font-size: 20px; font-weight: 600;">Your Login Code</h2>
                    <p style="margin: 0 0 25px; color: #4a4a4a; font-size: 16px; line-height: 1.5;">
                      Enter this code to sign in to your PodcastMeet account. The code will expire in 10 minutes.
                    </p>
                    <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 25px;">
                      <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a1a; font-family: monospace;">${otp}</span>
                    </div>
                    <p style="margin: 0; color: #888888; font-size: 14px; line-height: 1.5;">
                      If you didn't request this code, you can safely ignore this email. Someone may have typed your email address by mistake.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 30px 40px; border-top: 1px solid #eeeeee; text-align: center;">
                    <p style="margin: 0; color: #999999; font-size: 12px;">
                      This is an automated message from PodcastMeet. Please do not reply.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Your PodcastMeet login code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, you can safely ignore this email.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send OTP email:", error);
    return false;
  }
}

export async function verifyEmailConnection(): Promise<boolean> {
  if (!transporter) {
    return false;
  }

  try {
    await transporter.verify();
    console.log("Email connection verified successfully");
    return true;
  } catch (error) {
    console.error("Email connection verification failed:", error);
    return false;
  }
}
