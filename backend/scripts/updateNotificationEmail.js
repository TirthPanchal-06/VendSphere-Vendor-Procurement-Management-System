import { pool } from '../config/db.js';

const updateEmails = async () => {
  const client = await pool.connect();
  try {
    const targetEmail = 'tirthpanchal65@gmail.com';
    console.log(`Setting up real-time notification email for ${targetEmail}...`);

    // 1. Update Acme Admin in global_users
    await client.query(
      `UPDATE public.global_users SET email = $1 WHERE email = 'admin@acme.com'`,
      [targetEmail]
    );

    // 2. Update Acme Admin in tenant_acme.users
    await client.query('SET search_path TO "tenant_acme", public;');
    await client.query(
      `UPDATE users SET email = $1 WHERE role = 'Admin'`,
      [targetEmail]
    );

    // 3. Update sample vendor email to targetEmail or vendor notification
    await client.query(
      `UPDATE vendors SET email = $1 WHERE name LIKE '%Apex%' OR name LIKE '%Industrial%'`,
      [targetEmail]
    );

    console.log(`[SUCCESS] Admin user and vendors updated with email: ${targetEmail}`);

    const res = await client.query('SELECT id, name, email, role FROM users WHERE email = $1', [targetEmail]);
    console.log('Verified user profile:', res.rows);

  } catch (err) {
    console.error('Failed to update email in DB:', err.message);
  } finally {
    client.release();
    process.exit();
  }
};

updateEmails();

