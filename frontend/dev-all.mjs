import { spawn } from 'child_process';
import os from 'os';

function getLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const lanIp = getLanIp();

console.log('\n' + '='.repeat(70));
console.log('🚀 BRIDGE DUAL-PORT MULTI-DEVICE DEMO ORCHESTRATOR');
console.log('='.repeat(70));
console.log(`💻 LAPTOP 2 (SRE Incident Recovery Platform Console):`);
console.log(`   Local URL:    http://localhost:5173`);
console.log(`   Network URL:  http://${lanIp}:5173`);
console.log(``);
console.log(`🛍️ LAPTOP 1 (Dedicated End-User Storefront):`);
console.log(`   Local URL:    http://localhost:5174`);
console.log(`   Network URL:  http://${lanIp}:5174`);
console.log(``);
console.log(`⚙️ CENTRAL FASTAPI ENGINE (Core API & Persistence):`);
console.log(`   Network URL:  http://${lanIp}:8000`);
console.log('='.repeat(70) + '\n');

// Spawn Platform on Port 5173
const platformServer = spawn('npx', ['vite', '--port', '5173', '--host'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_PORT: '5173' },
});

// Spawn Storefront on Port 5174
const storeServer = spawn('npx', ['vite', '--port', '5174', '--host'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_PORT: '5174' },
});

function cleanup() {
  console.log('\nShutting down dual Vite servers...');
  try {
    platformServer.kill();
    storeServer.kill();
  } catch (_e) {}
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
