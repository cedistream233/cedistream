import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pg from 'pg';

dotenv.config();

const {
  DATABASE_URL,
  ADMIN_EMAIL = 'admin@cedistream.local',
  ADMIN_USERNAME = 'admin',
  ADMIN_PASSWORD = 'ChangeMe123!',
  ADMIN_FIRST_NAME = 'Admin',
  ADMIN_LAST_NAME = 'User',
} = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set in environment. Aborting.');
  process.exit(1);
}

(async () => {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected. Ensuring admin user exists...');

    // Ensure admin role allowed by constraint
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'users' AND c.conname = 'users_role_check'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_role_check;
        END IF;
      END $$;
    `);
    await client.query("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('creator','supporter','admin'));");

    // Create or update admin user
    const { rows } = await client.query('SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1', [ADMIN_EMAIL, ADMIN_USERNAME]);
    const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const pin_hash = await bcrypt.hash('0000', 10);
    if (rows.length) {
      const id = rows[0].id;
      await client.query(
        `UPDATE users SET email=$1, username=$2, password_hash=$3, pin_hash=$4, first_name=$5, last_name=$6, role='admin', is_active=true, is_verified=true, updated_at=NOW() WHERE id=$7`,
        [ADMIN_EMAIL, ADMIN_USERNAME, password_hash, pin_hash, ADMIN_FIRST_NAME, ADMIN_LAST_NAME, id]
      );
      console.log('Updated existing admin user:', ADMIN_EMAIL);
    } else {
      await client.query(
        `INSERT INTO users (email, username, password_hash, pin_hash, first_name, last_name, role, is_active, is_verified)
         VALUES ($1,$2,$3,$4,$5,$6,'admin',true,true)`,
        [ADMIN_EMAIL, ADMIN_USERNAME, password_hash, pin_hash, ADMIN_FIRST_NAME, ADMIN_LAST_NAME]
      );
      console.log('Inserted admin user:', ADMIN_EMAIL);
    }
    console.log('Done.');
  } catch (e) {
    console.error('Seeding admin failed:', e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
