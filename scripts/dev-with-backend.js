const { spawn } = require('child_process');

// Start the backend server
const backend = spawn('node', ['scripts/start-backend.js'], {
  stdio: 'inherit',
  shell: true,
});

// Start the frontend server
const frontend = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

// Handle exit events
const handleExit = (code) => {
  console.log(`Process exited with code: ${code}`);
  backend.kill();
  frontend.kill();
};

backend.on('exit', handleExit);
frontend.on('exit', handleExit);