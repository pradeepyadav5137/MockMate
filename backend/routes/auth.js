const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const router = express.Router();
const authController = require('../controllers/authController');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase();
      if (!email) return done(new Error('Google account has no email'));
      let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] });
      if (!user) {
        user = await User.create({ name: profile.displayName || email.split('@')[0], email, googleId: profile.id, avatar: profile.photos?.[0]?.value, isVerified: true });
      } else {
        user.googleId = user.googleId || profile.id;
        user.avatar = user.avatar || profile.photos?.[0]?.value;
        user.isVerified = true;
        await user.save();
      }
      return done(null, user);
    } catch (err) { return done(err); }
  }));
}

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.get('/me', protect, authController.getMe);
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ error: 'Google OAuth is not configured' });
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: (process.env.CLIENT_URL || 'http://localhost:3000') + '/login?error=google' }), authController.googleCallback);
module.exports = router;
