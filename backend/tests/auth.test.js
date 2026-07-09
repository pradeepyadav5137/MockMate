/**
 * Integration & Unit tests for Authorization logic.
 * Covers:
 * - protect: valid/invalid tokens, disabled user rejection.
 * - requireAdmin: blocks standard users, allows admins.
 * - requireInternalAuth: timing-safe check using AGENT_INTERNAL_SECRET.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const User = require('../models/User');

// Close server after tests
afterAll((done) => {
  if (app.server) {
    app.server.close(done);
  } else {
    done();
  }
});

describe('🔐 Authorization & Access Control Middleware', () => {
  let standardUser;
  let adminUser;
  let disabledUser;
  let standardToken;
  let adminToken;
  let disabledToken;

  beforeAll(async () => {
    // Override env values to ensure predictable JWT signing
    process.env.JWT_SECRET = 'test_jwt_secret_must_be_long_enough_32_chars';
    process.env.AGENT_INTERNAL_SECRET = 'test_agent_secret_key_12345';

    // Mock Users
    standardUser = await User.create({
      name: 'Standard User',
      email: 'standard@mockmate.in',
      password: 'password123',
      role: 'user',
      isVerified: true,
    });

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@mockmate.in',
      password: 'password123',
      role: 'admin',
      isVerified: true,
    });

    disabledUser = await User.create({
      name: 'Disabled User',
      email: 'disabled@mockmate.in',
      password: 'password123',
      role: 'user',
      status: 'disabled',
      isVerified: true,
    });

    standardToken = jwt.sign({ id: standardUser.id || standardUser._id }, process.env.JWT_SECRET);
    adminToken = jwt.sign({ id: adminUser.id || adminUser._id }, process.env.JWT_SECRET);
    disabledToken = jwt.sign({ id: disabledUser.id || disabledUser._id }, process.env.JWT_SECRET);
  });

  describe('JWT Verification & User Protection (protect)', () => {
    it('should reject requests without authorization headers', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('should reject requests with malformed tokens', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');
      expect(res.status).toBe(401);
    });

    it('should accept valid tokens and return 200', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${standardToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('standard@mockmate.in');
    });

    it('should reject disabled/banned users even with valid JWT tokens', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${disabledToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/account is disabled/i);
    });
  });

  describe('Role-Based Access Control (requireAdmin)', () => {
    it('should reject standard users from accessing admin routes', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${standardToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/admin access required/i);
    });

    it('should allow admin users to access admin routes', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      // If table/DB is empty, it returns 200 or 404/empty array, but not 403.
      expect(res.status).not.toBe(403);
    });
  });

  describe('Internal Service Communication (requireInternalAuth)', () => {
    it('should reject internal routes without key', async () => {
      const res = await request(app)
        .post('/api/interview/some-interview-id/start-timing');
      expect(res.status).toBe(401);
    });

    it('should reject internal routes with invalid key', async () => {
      const res = await request(app)
        .post('/api/interview/some-interview-id/start-timing')
        .set('x-internal-key', 'wrong_secret');
      expect(res.status).toBe(403);
    });

    it('should accept internal routes with correct AGENT_INTERNAL_SECRET', async () => {
      const res = await request(app)
        .post('/api/interview/some-interview-id/start-timing')
        .set('x-internal-key', process.env.AGENT_INTERNAL_SECRET)
        .send({ duration: 30 });
      // Returns 404 because interview-id is fake, but not 401/403.
      expect(res.status).toBe(404);
    });
  });
});
