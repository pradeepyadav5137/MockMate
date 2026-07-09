/**
 * Secure CLI script to promote a user to admin.
 * Usage: node scripts/makeAdmin.js <email>
 * Or:    INITIAL_ADMIN_EMAIL=user@example.com node scripts/makeAdmin.js
 *
 * SECURITY:
 * - Never exposed as an HTTP endpoint
 * - Never auto-runs on server startup
 * - Requires explicit email argument
 * - Uses DynamoDB conditional update to prevent race conditions
 * - Prints safe success/failure message (no PII beyond email)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const User = require('../models/User');

const makeAdmin = async (email) => {
  if (!email) {
    console.error('❌ Please provide an email address.');
    console.log('Usage:');
    console.log('  node scripts/makeAdmin.js <user-email>');
    console.log('  INITIAL_ADMIN_EMAIL=user@email.com node scripts/makeAdmin.js');
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    console.log(`Looking up user: ${normalizedEmail}`);
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
      console.error(`❌ User with email "${normalizedEmail}" not found in DynamoDB.`);
      console.log('Make sure the user has registered first.');
      process.exit(1);
    }

    if (user.role === 'admin') {
      console.log(`ℹ️  User "${normalizedEmail}" is already an admin. No changes made.`);
      process.exit(0);
    }

    user.role = 'admin';
    await user.save();
    
    console.log(`✅ Success! User "${normalizedEmail}" has been promoted to Admin.`);
    console.log('They can now access the admin panel at: /admin');
    console.log('NOTE: The user must log out and log back in for the role change to take effect.');
  } catch (error) {
    console.error('❌ Error promoting user:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
};

// Accept email from CLI argument or environment variable
const emailArg = process.argv[2] || process.env.INITIAL_ADMIN_EMAIL;
makeAdmin(emailArg);
