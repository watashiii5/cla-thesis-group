const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, '..', 'backend');

console.log('🔧 Setting up Python backend...\n');

// Check if Python is installed
try {
  const pythonVersion = execSync('python --version', { encoding: 'utf-8' });
  console.log('✅ Python found:', pythonVersion.trim());
} catch (error) {
  console.error('❌ Python is not installed or not in PATH');
  console.log('Please install Python 3.11 or 3.12 from https://www.python.org/downloads/');
  process.exit(1);
}

// Check if requirements.txt exists
const requirementsPath = path.join(backendDir, 'requirements.txt');
if (!fs.existsSync(requirementsPath)) {
  console.error('❌ requirements.txt not found at:', requirementsPath);
  process.exit(1);
}

// Upgrade pip
console.log('📦 Upgrading pip...');
try {
  execSync('python -m pip install --upgrade pip', { 
    stdio: 'inherit',
    shell: true
  });
  console.log('✅ Pip upgraded\n');
} catch (error) {
  console.warn('⚠️  Could not upgrade pip, continuing...\n');
}

// Install dependencies
console.log('📦 Installing Python dependencies...');
try {
  execSync('pip install -r requirements.txt', { 
    cwd: backendDir, 
    stdio: 'inherit',
    shell: true
  });
  console.log('\n✅ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  console.error('\nTry running manually:');
  console.error('  cd backend');
  console.error('  pip install -r requirements.txt');
  process.exit(1);
}

console.log('\n🎉 Backend setup complete!');
console.log('Run "npm run dev" to start both frontend and backend');