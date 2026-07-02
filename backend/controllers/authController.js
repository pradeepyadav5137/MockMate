const crypto = require('crypto');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const emailService = require('../services/emailService');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || 'dev_secret', {
  expiresIn: process.env.JWT_EXPIRE || '7d',
});

const createVerificationToken = () => crypto.randomBytes(32).toString('hex');

const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.verificationToken;
  delete obj.verificationTokenExpires;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.comparePassword;
  delete obj.save;
  return obj;
};

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required', message: 'Name, email, and password are required' });
    const normalizedEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) return res.status(400).json({ error: 'User already exists', message: 'An account with this email already exists' });
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: await bcrypt.hash(password, 10),
      isVerified: false,
      verificationToken: createVerificationToken(),
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await emailService.sendVerificationEmail(user).catch((err) => console.error('Verification email failed:', err.message));
    res.status(201).json({ token: generateToken(user._id || user.id), user: sanitizeUser(user) });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const login = async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = req.body.password;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required', message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'Invalid credentials', message: 'Invalid email or password' });
    }
    res.json({ token: generateToken(user._id || user.id), user: sanitizeUser(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message, message: 'Login failed. Please try again.' });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const user = await User.findOne({ verificationToken: req.params.token });
    if (!user) return res.status(400).json({ message: 'Verification link is invalid or expired' });
    
    if (user.verificationTokenExpires && new Date(user.verificationTokenExpires) < new Date()) {
      return res.status(400).json({ message: 'Verification link is invalid or expired' });
    }

    user.isVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const resendVerification = async (req, res) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || '').toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isVerified) return res.json({ success: true, message: 'Email is already verified' });
    user.verificationToken = createVerificationToken();
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    await emailService.sendVerificationEmail(user);
    res.json({ success: true, message: 'Verification email sent' });
  } catch (err) { res.status(500).json({ error: err.message, message: 'Failed to send verification email' }); }
};

const forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || '').toLowerCase().trim() });
    if (!user) return res.json({ success: true });
    user.resetPasswordToken = createVerificationToken();
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await emailService.sendEmail({
      to: user.email,
      subject: 'Reset your MockMate password',
      html: emailService.getPasswordResetTemplate(user.name, user.resetPasswordToken, process.env.CLIENT_URL || 'http://localhost:3000'),
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const resetPassword = async (req, res) => {
  try {
    const user = await User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: 'Reset link is invalid or expired' });
    user.password = await bcrypt.hash(req.body.password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).select('-password -verificationToken -verificationTokenExpires -resetPasswordToken -resetPasswordExpires');
    res.json({ user });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

const googleCallback = (req, res) => {
  const token = generateToken(req.user._id);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  res.redirect(clientUrl + '/auth/callback?token=' + token);
};

module.exports = { register, login, verifyEmail, resendVerification, forgotPassword, resetPassword, getMe, googleCallback, generateToken };
