require('dotenv').config({ path: '../.env' });
const User = require('../models/User');

const makeAdmin = async (email) => {
  if (!email) {
    console.error('❌ Please provide an email address.');
    console.log('Usage: node makeAdmin.js <user-email>');
    process.exit(1);
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error(`❌ User with email ${email} not found.`);
      process.exit(1);
    }

    user.role = 'admin';
    await user.save();
    
    console.log(`✅ Success! User ${email} has been promoted to Admin.`);
    console.log('They can now access the admin panel at: http://localhost:3000/admin');
  } catch (error) {
    console.error('❌ Error promoting user:', error.message);
  } finally {
    process.exit(0);
  }
};

const emailArg = process.argv[2];
makeAdmin(emailArg);
