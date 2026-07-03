const cron = require('node-cron');
const Interview = require('./models/Interview');
const User = require('./models/User');
const { deleteRecording } = require('./services/storageService');
const { sendEmail } = require('./services/emailService');

// Flag to prevent overlapping execution
let isCleanupRunning = false;

const startCronJobs = () => {
  // Hourly cron for reminders and cleanup
  cron.schedule('0 * * * *', async () => {
    if (isCleanupRunning) return;
    isCleanupRunning = true;
    
    try {
      const now = new Date();
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      // Fetch all interviews that have not had their recordings deleted
      const allInterviews = await Interview.find({ recordingDeletedAt: null });

      // 1. Reminders: recordingExpiresAt is within the next 2 hours AND recordingUnlocked === false AND no reminderEmailSent
      const toRemind = allInterviews.filter(
        (i) =>
          !i.recordingUnlocked &&
          i.pricingTier !== 'pro' &&
          !i.reminderEmailSent &&
          i.recordingExpiresAt &&
          i.recordingPath &&
          new Date(i.recordingExpiresAt) > now &&
          new Date(i.recordingExpiresAt) <= twoHoursFromNow
      );

      for (const interview of toRemind) {
        try {
          const user = await User.findById(interview.userId);
          if (!user) continue;
          await sendEmail({
            to: user.email,
            subject: 'LAST CHANCE: Your mock interview recording expires in 2 hours',
            html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:Inter,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;overflow:hidden;border:1px solid rgba(139,92,246,0.3);">
    <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">⏰ Recording Expiring Soon</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#e2e8f0;margin-top:0;">Hi ${user.name},</h2>
      <p style="color:#94a3b8;line-height:1.8;">Your interview recording will expire in less than <strong style="color:#f87171;">2 hours</strong>. After that, it will be permanently deleted.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/recordings" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;display:inline-block;">Access Recording Now</a>
      </div>
      <p style="color:#64748b;font-size:13px;">Unlock your recording for ₹9 before it expires.</p>
    </div>
  </div>
</body>
</html>`,
          });
          interview.reminderEmailSent = true;
          await interview.save();
        } catch (e) {
          console.error(`Failed to send reminder for ${interview._id}:`, e.message);
        }
      }

      // 2. Cleanup: recordingExpiresAt < now() — delete local file and mark expired
      const toDelete = allInterviews.filter(
        (i) => i.recordingPath && i.recordingExpiresAt && new Date(i.recordingExpiresAt) < now
      );

      for (const interview of toDelete) {
        try {
          // Delete local recording file
          await deleteRecording(interview.recordingPath);
          console.log(`[CLEANUP] Deleted recording for Interview ${interview._id} (User: ${interview.userId}). Unlocked: ${interview.recordingUnlocked}`);
        } catch (e) {
          console.error(`[CLEANUP] File delete failed for ${interview._id}:`, e.message);
        }

        interview.recordingDeletedAt = new Date().toISOString();
        interview.recordingPath = null;
        interview.recordingStatus = 'expired';
        await interview.save();
      }
      
    } catch (e) {
      console.error('Error in cleanup cron:', e.message);
    } finally {
      isCleanupRunning = false;
    }
  });
};

module.exports = startCronJobs;
