import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../lib/database.js';
import { generateToken, authenticateToken } from '../lib/auth.js';

const router = express.Router();
const MAX_PIN_ATTEMPTS = 5; // configurable
const LOCKOUT_MINUTES = 15; // configurable

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { 
      email,
      username,
      password,
      pin, // 4-digit PIN for password reset
      firstName,
      lastName,
      role = 'supporter',
      stageName,
      genreSpecialties = [],
      socialMedia = {}
    } = req.body;

    // Validate required fields
    if (!email || !username || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, username, password, first name, and last name are required' });
    }

    if (!['creator', 'supporter'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either creator or supporter' });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if username exists
    const existingUsername = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUsername.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Validate and hash PIN if provided (must be 4 digits)
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'A 4-digit PIN is required for account recovery' });
    }
    const pinHash = await bcrypt.hash(pin, saltRounds);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, username, password_hash, pin_hash, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, email, username, first_name, last_name, role, created_at`,
      [email, username, passwordHash, pinHash, firstName, lastName, role]
    );

    const user = userResult.rows[0];

    // If creator, create creator profile
    if (role === 'creator') {
      await query(
        `INSERT INTO creator_profiles (user_id, stage_name, genre_specialties, social_media)
         VALUES ($1, $2, $3, $4)`,
        [user.id, stageName || null, genreSpecialties, JSON.stringify(socialMedia)]
      );
    }

    // Generate JWT token
    const token = generateToken(user);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        createdAt: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or username

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' });
    }

    // Get user from database
    let result;
    // Determine if identifier looks like an email
    const looksLikeEmail = /.+@.+\..+/.test(identifier);
    if (looksLikeEmail) {
      result = await query(
        'SELECT id, email, username, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
        [identifier]
      );
    } else {
      result = await query(
        'SELECT id, email, username, password_hash, first_name, last_name, role, is_active FROM users WHERE username = $1',
        [identifier]
      );
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate JWT token
    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    let userQuery = `
      SELECT u.id, u.email, u.username, u.first_name, u.last_name, u.role, u.profile_image, 
             u.bio, u.phone, u.country, u.is_verified, u.created_at, u.last_login
      FROM users u WHERE u.id = $1
    `;

    const userResult = await query(userQuery, [userId]);
  const user = userResult.rows[0];

    // If creator, get creator profile
    if (user.role === 'creator') {
      const creatorResult = await query(
        `SELECT stage_name, genre_specialties, social_media, bank_account_name, 
                bank_account_number, bank_name, total_earnings, total_sales
         FROM creator_profiles WHERE user_id = $1`,
        [userId]
      );
      
      if (creatorResult.rows.length > 0) {
        user.creatorProfile = creatorResult.rows[0];
      }
    }

    res.json(user);

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { firstName, lastName, bio, phone, country, profileImage } = req.body;

    const result = await query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name), 
           bio = COALESCE($3, bio),
           phone = COALESCE($4, phone),
           country = COALESCE($5, country),
           profile_image = COALESCE($6, profile_image),
           updated_at = NOW()
       WHERE id = $7
       RETURNING id, email, first_name, last_name, role, bio, phone, country, profile_image`,
      [firstName, lastName, bio, phone, country, profileImage, userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

// -------- Password reset using 4-digit PIN --------

// Start password reset: verify identifier (email/username) and check PIN with rate limiting
router.post('/reset/start', async (req, res) => {
  try {
    const { identifier, pin } = req.body;
    if (!identifier || !pin) {
      return res.status(400).json({ error: 'Identifier and PIN are required' });
    }

    // Find user by email or username
    const looksLikeEmail = /.+@.+\..+/.test(identifier);
    const result = await query(
      looksLikeEmail
        ? 'SELECT id, email, username, pin_hash, pin_attempts, pin_lock_until FROM users WHERE email = $1'
        : 'SELECT id, email, username, pin_hash, pin_attempts, pin_lock_until FROM users WHERE username = $1',
      [identifier]
    );

    if (result.rows.length === 0) {
      // Do not reveal user existence
      return res.status(200).json({ ok: true });
    }

    const user = result.rows[0];

    // Check lockout
    if (user.pin_lock_until && new Date(user.pin_lock_until) > new Date()) {
      return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    // Verify PIN
    const pinOk = await bcrypt.compare(String(pin), user.pin_hash || '');
    if (!pinOk) {
      const attempts = (user.pin_attempts || 0) + 1;
      let lockUntilClause = null;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        lockUntilClause = `, pin_lock_until = NOW() + INTERVAL '${LOCKOUT_MINUTES} minutes'`;
      }
      await query(
        `UPDATE users SET pin_attempts = $1${lockUntilClause || ''} WHERE id = $2`,
        [attempts, user.id]
      );
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // Reset attempts on success
    await query('UPDATE users SET pin_attempts = 0, pin_lock_until = NULL WHERE id = $1', [user.id]);

    // Issue a short-lived reset token stored in-memory-less: we can return a one-time token encoded with user id and timestamp
    // For simplicity: return a minimal opaque token derived from DB with time-bound encoded in JWT-like manner using existing token generator is overkill since it adds username/role; implement a simple signed token here
    const resetTokenResult = await query('SELECT NOW() as now');
    const issuedAt = resetTokenResult.rows[0].now;
    // Return a server-side-free token: include user id and issuedAt encoded base64, client must send back to complete endpoint
    const payload = Buffer.from(JSON.stringify({ uid: user.id, iat: issuedAt })).toString('base64url');
    return res.json({ ok: true, resetToken: payload });
  } catch (error) {
    console.error('Reset start error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete password reset: set a new password using the provided reset token
router.post('/reset/complete', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Decode token
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(String(resetToken), 'base64url').toString());
    } catch (e) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    const { uid, iat } = decoded || {};
    if (!uid || !iat) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Optional expiry: 30 minutes
    const expiryCheck = await query('SELECT NOW() as now');
    const now = new Date(expiryCheck.rows[0].now);
    const issued = new Date(iat);
    const diffMinutes = (now.getTime() - issued.getTime()) / 60000;
    if (diffMinutes > 30) {
      return res.status(400).json({ error: 'Reset token expired' });
    }

    // Update password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, uid]);

    return res.json({ ok: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset complete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Username availability check
router.get('/username-available', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username is required' });
    const result = await query('SELECT 1 FROM users WHERE username = $1', [username]);
    return res.json({ available: result.rows.length === 0 });
  } catch (error) {
    console.error('Username availability error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update PIN for authenticated user
// Requires current password to authorize the change
router.patch('/pin', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPin, confirmPin } = req.body;

    if (!currentPassword || !newPin || !confirmPin) {
      return res.status(400).json({ error: 'currentPassword, newPin and confirmPin are required' });
    }

    if (newPin !== confirmPin) {
      return res.status(400).json({ error: 'New PINs do not match' });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ error: 'New PIN must be exactly 4 digits' });
    }

    // Fetch user password hash and PIN rate-limit fields to verify current password and check lockout
    const result = await query('SELECT password_hash, pin_attempts, pin_lock_until FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password_hash, pin_attempts, pin_lock_until } = result.rows[0];

    // Check lockout (reuse pin_lock_until)
    if (pin_lock_until && new Date(pin_lock_until) > new Date()) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Try again later.' });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, password_hash);
    if (!passwordMatch) {
      const attempts = (pin_attempts || 0) + 1;
      let lockUntilClause = null;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        lockUntilClause = `, pin_lock_until = NOW() + INTERVAL '${LOCKOUT_MINUTES} minutes'`;
      }
      await query(`UPDATE users SET pin_attempts = $1${lockUntilClause || ''} WHERE id = $2`, [attempts, userId]);
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new PIN and store
    const saltRounds = 10;
    const newPinHash = await bcrypt.hash(String(newPin), saltRounds);

    await query(
      'UPDATE users SET pin_hash = $1, pin_attempts = 0, pin_lock_until = NULL, updated_at = NOW() WHERE id = $2',
      [newPinHash, userId]
    );

    return res.json({ ok: true, message: 'PIN updated successfully' });
  } catch (error) {
    console.error('PIN update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});