#!/usr/bin/env node

/**
 * Setup script for e2e test data
 * This script helps set up test users in Supabase for e2e testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Setting up e2e test data...\n');

// Check if migration file exists
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251222100000_add_test_users_for_e2e.sql');

if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file not found:', migrationPath);
  console.log('\nPlease ensure the migration file exists and try again.');
  process.exit(1);
}

console.log('✅ Migration file found:', path.basename(migrationPath));
console.log('\n📋 Test Users Created:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Basic User:');
console.log('  Email: test@example.com');
console.log('  Password: testpassword123');
console.log('  Role: Basic User (can create personal properties)');
console.log('');
console.log('Company Admin:');
console.log('  Email: admin@testcompany.com');
console.log('  Password: adminpassword123');
console.log('  Role: Company Admin (can create company properties)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n📖 Next Steps:');
console.log('1. Apply the migration to your Supabase database:');
console.log('   - Go to Supabase Dashboard → SQL Editor');
console.log('   - Copy and paste the migration file content');
console.log('   - Run the SQL');
console.log('');
console.log('2. Or use Supabase CLI:');
console.log('   supabase db reset');
console.log('');
console.log('3. Set up environment variables:');
console.log('   - Copy e2e/env.example.txt to .env.local');
console.log('   - Update with your Supabase credentials');
console.log('');
console.log('4. Run the tests:');
console.log('   npx playwright test');
console.log('');

console.log('🚀 Ready to test!');
console.log('See e2e/README.md for detailed instructions.\n');
