const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Laha Space <noreply@lahaspace.com>';

// ─── Teacher application confirmation ────────────────────────
async function sendApplicationConfirmation(teacher) {
  await resend.emails.send({
    from: FROM,
    to: teacher.email,
    subject: 'We have received your application - Laha Space',
    html: `
      <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a2e2c;">
        <img src="https://lahaspace.com/images/logo-dark.png" alt="Laha Space" style="height:40px;margin-bottom:32px;" />
        <h1 style="font-size:24px;font-weight:600;margin-bottom:16px;">JazakAllahu khairan, ${teacher.name}</h1>
        <p style="font-size:15px;line-height:1.7;color:#3d5a56;margin-bottom:16px;">
          We have received your application to teach with Laha Space. Our team will review everything you have submitted and get back to you with next steps.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#3d5a56;margin-bottom:16px;">
          This process is thorough because the sisters learning here deserve nothing less. We appreciate your patience.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#3d5a56;margin-bottom:32px;">
          If you have any questions in the meantime, feel free to reach out at <a href="mailto:support@lahaspace.com" style="color:#2E847B;">support@lahaspace.com</a>.
        </p>
        <div style="border-top:1px solid #e0e8e6;padding-top:24px;font-size:13px;color:#7a9490;">
          Laha Space · Space for Her to Learn. Heal. Connect.
        </div>
      </div>
    `
  });
}

// ─── Booking confirmation to student ─────────────────────────
async function sendBookingConfirmationStudent({ studentName, studentEmail, teacherName, slotDate, slotStart, slotEnd, teacherTimezone }) {
  const dateStr = new Date(slotDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  await resend.emails.send({
    from: FROM,
    to: studentEmail,
    subject: 'Your discovery session is booked - Laha Space',
    html: `
      <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a2e2c;">
        <img src="https://lahaspace.com/images/logo-dark.png" alt="Laha Space" style="height:40px;margin-bottom:32px;" />
        <h1 style="font-size:24px;font-weight:600;margin-bottom:16px;">Your session is confirmed, ${studentName}</h1>
        <p style="font-size:15px;line-height:1.7;color:#3d5a56;margin-bottom:24px;">
          Your discovery session with <strong>${teacherName}</strong> has been booked. Here are the details:
        </p>
        <div style="background:#f4f9f8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <table style="font-size:14px;width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#7a9490;width:120px;">Teacher</td><td style="padding:6px 0;font-weight:500;">${teacherName}</td></tr>
            <tr><td style="padding:6px 0;color:#7a9490;">Date</td><td style="padding:6px 0;font-weight:500;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#7a9490;">Time</td><td style="padding:6px 0;font-weight:500;">${slotStart} – ${slotEnd}</td></tr>
            ${teacherTimezone ? `<tr><td style="padding:6px 0;color:#7a9490;">Timezone</td><td style="padding:6px 0;font-weight:500;">${teacherTimezone}</td></tr>` : ''}
          </table>
        </div>
        <p style="font-size:14px;line-height:1.7;color:#3d5a56;margin-bottom:32px;">
          The teacher will be in touch with you shortly with session details. Please make sure the timezone matches yours before the session.
        </p>
        <div style="border-top:1px solid #e0e8e6;padding-top:24px;font-size:13px;color:#7a9490;">
          Laha Space · Space for Her to Learn. Heal. Connect.
        </div>
      </div>
    `
  });
}

// ─── Booking notification to teacher ─────────────────────────
async function sendBookingNotificationTeacher({ teacherName, teacherEmail, studentName, studentEmail, studentPhone, slotDate, slotStart, slotEnd, lookingFor }) {
  const dateStr = new Date(slotDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  await resend.emails.send({
    from: FROM,
    to: teacherEmail,
    subject: 'New discovery session booked - Laha Space',
    html: `
      <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a2e2c;">
        <img src="https://lahaspace.com/images/logo-dark.png" alt="Laha Space" style="height:40px;margin-bottom:32px;" />
        <h1 style="font-size:24px;font-weight:600;margin-bottom:16px;">You have a new booking, ${teacherName}</h1>
        <p style="font-size:15px;line-height:1.7;color:#3d5a56;margin-bottom:24px;">
          A sister has booked a discovery session with you. Here are her details:
        </p>
        <div style="background:#f4f9f8;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
          <table style="font-size:14px;width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#7a9490;width:140px;">Student name</td><td style="padding:6px 0;font-weight:500;">${studentName}</td></tr>
            <tr><td style="padding:6px 0;color:#7a9490;">Email</td><td style="padding:6px 0;font-weight:500;">${studentEmail}</td></tr>
            <tr><td style="padding:6px 0;color:#7a9490;">Phone</td><td style="padding:6px 0;font-weight:500;">${studentPhone}</td></tr>
            <tr><td style="padding:6px 0;color:#7a9490;">Date</td><td style="padding:6px 0;font-weight:500;">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#7a9490;">Time</td><td style="padding:6px 0;font-weight:500;">${slotStart} – ${slotEnd}</td></tr>
            ${lookingFor ? `<tr><td style="padding:6px 0;color:#7a9490;">Looking for</td><td style="padding:6px 0;font-weight:500;">${lookingFor}</td></tr>` : ''}
          </table>
        </div>
        <p style="font-size:14px;line-height:1.7;color:#3d5a56;margin-bottom:32px;">
          Please reach out to the student directly to confirm the session link and details. JazakAllahu khairan for your dedication.
        </p>
        <div style="border-top:1px solid #e0e8e6;padding-top:24px;font-size:13px;color:#7a9490;">
          Laha Space · Space for Her to Learn. Heal. Connect.
        </div>
      </div>
    `
  });
}

// ─── Community approval + WhatsApp link ──────────────────────
async function sendCommunityApproval({ name, email, whatsappLink }) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'You are in - welcome to the Laha Space community',
    html: `
      <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a2e2c;">
        <img src="https://lahaspace.com/images/logo-dark.png" alt="Laha Space" style="height:40px;margin-bottom:32px;" />
        <h1 style="font-size:24px;font-weight:600;margin-bottom:16px;">Welcome, ${name} 💚</h1>
        <p style="font-size:15px;line-height:1.7;color:#3d5a56;margin-bottom:16px;">
          We have listened to your voice note and reviewed your application. We are so glad you are joining us.
        </p>
        <p style="font-size:15px;line-height:1.7;color:#3d5a56;margin-bottom:32px;">
          Click the button below to join the Laha Space WhatsApp community. We cannot wait to welcome you in.
        </p>
        <a href="${whatsappLink}" style="display:inline-block;background:#2E847B;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;margin-bottom:32px;">
          Join the community →
        </a>
        <p style="font-size:13px;color:#7a9490;margin-bottom:32px;">
          If the button does not work, copy and paste this link: <a href="${whatsappLink}" style="color:#2E847B;">${whatsappLink}</a>
        </p>
        <div style="border-top:1px solid #e0e8e6;padding-top:24px;font-size:13px;color:#7a9490;">
          Laha Space · Space for Her to Learn. Heal. Connect.
        </div>
      </div>
    `
  });
}

module.exports = {
  sendApplicationConfirmation,
  sendBookingConfirmationStudent,
  sendBookingNotificationTeacher,
  sendCommunityApproval
};
