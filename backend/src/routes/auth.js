import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../lib/database.js';
import { generateToken, authenticateToken } from '../lib/auth.js';

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      role = 'supporter',
      stageName,
      bio,
      genreSpecialties = [],
      socialMedia = {}
    } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
    }

    if (!['creator', 'supporter'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either creator or supporter' });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userResult = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, bio) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email, passwordHash, firstName, lastName, role, bio || null]
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user from database
    const result = await query(
      'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
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
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.profile_image, 
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