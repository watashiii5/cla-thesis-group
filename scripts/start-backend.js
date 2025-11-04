const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const backendDir = path.join(__dirname, '..', 'backend');

console.log('🔧 Starting Backend Server...');
console.log('📁 Backend directory:', backendDir);

// Check if main.py exists
const mainPyPath = path.join(backendDir, 'main.py');
if (!fs.existsSync(mainPyPath)) {
  console.error('❌ main.py not found at:', mainPyPath);
  console.log('Please ensure all backend files are created');
  process.exit(1);
}

// Check if Python is available
try {
  const pythonVersion = execSync('python --version', { encoding: 'utf-8' });
  console.log('✅ Using Python:', pythonVersion.trim());
} catch (error) {
  console.error('❌ Python not found. Please install Python 3.11 or 3.12');
  process.exit(1);
}

// Check if required packages are installed
console.log('📦 Checking dependencies...');
try {
  execSync('python -c "import fastapi, uvicorn"', { encoding: 'utf-8', stdio: 'pipe' });
  console.log('✅ Dependencies installed');
} catch (error) {
  console.error('❌ Missing dependencies!');
  console.log('\n📦 Installing backend dependencies...\n');
  try {
    execSync('pip install -r requirements.txt', { 
      cwd: backendDir, 
      stdio: 'inherit',
      shell: true 
    });
    console.log('\n✅ Dependencies installed successfully');
  } catch (installError) {
    console.error('❌ Failed to install dependencies');
    console.log('Please run manually: cd backend && pip install -r requirements.txt');
    process.exit(1);
  }
}

console.log('🚀 Starting uvicorn server...\n');

// Start uvicorn server using system Python
const backend = spawn(
  'python', 
  ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000', '--host', 'localhost'], 
  {
    cwd: backendDir,
    shell: true,
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  }
);

let started = false;

backend.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
    if (!started) {
      started = true;
      console.log('\n✅ Backend server is ready!');
      console.log('🌐 API: http://localhost:8000');
      console.log('📚 Docs: http://localhost:8000/docs');
      console.log('❤️  Health: http://localhost:8000/health\n');
    }
  }
});

backend.stderr.on('data', (data) => {
  const error = data.toString();
  
  // Ignore common warnings
  if (error.includes('watchfiles') || error.includes('WatchFilesReload')) {
    return;
  }
  
  process.stderr.write(error);
});

backend.on('error', (error) => {
  console.error('❌ Failed to start backend:', error.message);
  process.exit(1);
});

backend.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`\n⚠️  Backend process exited with code ${code}`);
  }
});

// Handle termination
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping backend server...');
  backend.kill('SIGINT');
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  backend.kill('SIGTERM');
  setTimeout(() => process.exit(0), 1000);
});