require('dotenv').config();
const fetch = globalThis.fetch || require('node-fetch');

const base = 'http://localhost:3000';

async function main(){
  // register
  const email = `e2e+${Date.now()}@example.com`;
  console.log('registering', email);
  let res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({name:'E2E Test', email, password:'password123'})
  });
  console.log('register status', res.status);
  const reg = await res.json().catch(()=>null);
  console.log('reg body', reg);

  // login
  res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({email, password:'password123'})
  });
  console.log('login status', res.status);
  const login = await res.json();
  console.log('login body', login);
  const token = login.accessToken || login.token || login.access_token || login?.data?.accessToken;
  if(!token){
    console.error('no token returned');
    return;
  }

  // call routine-coach
  res = await fetch(`${base}/api/ai/routine-coach`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('routine-coach status', res.status);
  const body = await res.text();
  console.log('routine-coach body', body);
}

main().catch(e=>{ console.error(e); process.exit(1); });
