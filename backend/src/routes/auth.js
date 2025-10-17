import express from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { query } from '../lib/database.js';
import { generateToken, authenticateToken, generateResetToken, verifyResetToken } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';

const router = express.Router();
const MAX_PIN_ATTEMPTS = 5; // configurable
const LOCKOUT_MINUTES = 60; // configurable per product: ~1 hour lockout
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

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

    // Check if user already exists (case-insensitive)
    const existingUser = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if username exists
    const existingUsername = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
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
      // Case-insensitive email lookup
      result = await query(
        'SELECT id, email, username, password_hash, first_name, last_name, role, is_active FROM users WHERE LOWER(email) = LOWER($1)',
        [identifier]
      );
    } else {
      // Case-insensitive username lookup
      result = await query(
        'SELECT id, email, username, password_hash, first_name, last_name, role, is_active FROM users WHERE LOWER(username) = LOWER($1)',
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

// Upload/Change profile image
router.post('/profile/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Storage not configured' });
    const userId = req.user.id;
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    // Generate a unique path
    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const filePath = `profiles/${userId}/${Date.now()}.${ext}`;

    const bucket = process.env.SUPABASE_BUCKET || 'profiles';
    let imageUrl = null;
    try {
      imageUrl = await uploadToStorage(bucket, filePath, req.file.buffer, req.file.mimetype || 'image/jpeg');
    } catch (err) {
      console.error('Supabase upload error (profile image):', err);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    // Update user profile_image
    const result = await query(
      `UPDATE users SET profile_image = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, email, username, first_name, last_name, role, profile_image`,
      [imageUrl, userId]
    );

    return res.json({ ok: true, user: result.rows[0] });
  } catch (error) {
    console.error('Profile image upload error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove profile image
router.delete('/profile/image', authenticateToken, async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Storage not configured' });
    const userId = req.user.id;
    // Load current image to attempt deletion
    const result = await query('SELECT profile_image FROM users WHERE id = $1', [userId]);
    const current = result.rows[0]?.profile_image;
    if (current) {
    try {
      const url = new URL(current);
      // Supabase public URL contains the path after "/object/public/<bucket>/"
      const parts = url.pathname.split('/');
      const idx = parts.findIndex(p => p === 'object');
      const bucket = process.env.SUPABASE_BUCKET || 'profiles';
      let objectPath = null;
      if (idx >= 0) {
        // format: /object/public/<bucket>/<path>
        objectPath = parts.slice(idx + 3).join('/');
      } else {
        // fallback: attempt to remove leading slash and bucket name
        const bucketIdx = parts.findIndex(p => p === bucket);
        objectPath = bucketIdx >= 0 ? parts.slice(bucketIdx + 1).join('/') : parts.slice(1).join('/');
      }
      if (objectPath) {
        await supabase.storage
          .from(bucket)
          .remove([objectPath]);
      }
      } catch (e) {
        // Continue even if delete fails
        console.warn('Failed to parse/delete old profile image:', e?.message || e);
      }
    }

    const updated = await query(
      `UPDATE users SET profile_image = NULL, updated_at = NOW() WHERE id = $1
       RETURNING id, email, username, first_name, last_name, role, profile_image`,
      [userId]
    );

    return res.json({ ok: true, user: updated.rows[0] });
  } catch (error) {
    console.error('Profile image remove error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password (requires current password)
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmNewPassword } = req.body || {};

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ error: 'currentPassword, newPassword and confirmNewPassword are required' });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ error: 'New passwords do not match' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const saltRounds = 10;
    const newHash = await bcrypt.hash(String(newPassword), saltRounds);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);

    return res.json({ ok: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Change email (requires current password)
router.post('/change-email', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newEmail } = req.body || {};

    if (!currentPassword || !newEmail) {
      return res.status(400).json({ error: 'currentPassword and newEmail are required' });
    }
    // basic email format check
    if (!/.+@.+\..+/.test(String(newEmail))) {
      return res.status(400).json({ error: 'Please provide a valid email address' });
    }

    const userRes = await query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    // ensure email not taken by someone else
    const exists = await query('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [newEmail, userId]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: 'Email is already in use' });
    }

    const updated = await query(
      'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, username, first_name, last_name, role',
      [newEmail, userId]
    );

    return res.json({ ok: true, message: 'Email changed successfully', user: updated.rows[0] });
  } catch (error) {
    console.error('Change email error:', error);
    return res.status(500).json({ error: 'Internal server error' });
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

    // Check lockout and report remaining time if locked
    if (user.pin_lock_until && new Date(user.pin_lock_until) > new Date()) {
      const msLeft = new Date(user.pin_lock_until) - new Date();
      const minsLeft = Math.ceil(msLeft / 60000);
      return res.status(429).json({ error: `Too many attempts. Please try again in ${minsLeft} minute(s).` });
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
      if (attempts >= MAX_PIN_ATTEMPTS) {
        // Locked now - inform user of lock duration
        return res.status(429).json({ error: `Too many attempts. Account locked for ${LOCKOUT_MINUTES} minute(s). Please try again later.` });
      }
      return res.status(401).json({ error: 'Invalid PIN' });
    }

    // Reset attempts on success
    await query('UPDATE users SET pin_attempts = 0, pin_lock_until = NULL WHERE id = $1', [user.id]);

  // Issue a signed JWT reset token (30m expiry)
  const resetToken = generateResetToken(user.id);
  return res.json({ ok: true, resetToken });
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

    const decoded = verifyResetToken(resetToken);
    if (!decoded?.uid) return res.status(400).json({ error: 'Invalid or expired reset token' });

    // Update password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
  await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, decoded.uid]);

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

    // Check lockout (reuse pin_lock_until) and report remaining time
    if (pin_lock_until && new Date(pin_lock_until) > new Date()) {
      const msLeft = new Date(pin_lock_until) - new Date();
      const minsLeft = Math.ceil(msLeft / 60000);
      return res.status(429).json({ error: `Too many incorrect attempts. Account locked for ${minsLeft} minute(s).` });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, password_hash);
    if (!passwordMatch) {
      const attempts = (pin_attempts || 0) + 1;
      let lockUntilClause = null;
      if (attempts >= MAX_PIN_ATTEMPTS) {
        lockUntilClause = `, pin_lock_until = NOW() + INTERVAL '${LOCKOUT_MINUTES} minutes'`;
      }
      await query(`UPDATE users SET pin_attempts = $1${lockUntilClause || ''} WHERE id = $2`, [attempts, userId]);
      if (attempts >= MAX_PIN_ATTEMPTS) {
        return res.status(429).json({ error: `Too many incorrect attempts. Account locked for ${LOCKOUT_MINUTES} minute(s).` });
      }
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