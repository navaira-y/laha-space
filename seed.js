require('dotenv').config();
const bcrypt = require('bcryptjs');
const supabase = require('./database');

async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@lahaspace.com';
  const password = process.env.ADMIN_PASSWORD || 'LahaAdmin2024!';
  const hash = bcrypt.hashSync(password, 12);

  const { data: existing } = await supabase
    .from('admins')
    .select('id')
    .eq('email', email)
    .single();

  if (existing) {
    await supabase.from('admins').update({ password_hash: hash }).eq('email', email);
    console.log(`✅ Admin updated: ${email}`);
  } else {
    await supabase.from('admins').insert({ email, password_hash: hash });
    console.log(`✅ Admin created: ${email}`);
  }

  console.log(`🔑 Password: ${password}`);
  console.log(`\n⚠️  Change your password after first login!`);
}

seed().catch(console.error);
