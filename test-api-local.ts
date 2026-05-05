import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const uid = 'cmk6pk7i600007qwl6lvep5hz'; // fernando
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  const token = jwt.sign({ userId: uid }, secret);
  
  const from = new Date(); from.setDate(from.getDate() - 14);
  const to = new Date(); to.setDate(to.getDate() + 14);
  
  const res = await fetch(`http://localhost:3000/api/daily-todos?from=${from.toISOString()}&to=${to.toISOString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!res.ok) {
    console.log("Error:", res.status, await res.text());
  } else {
    const data = await res.json();
    console.log("Tasks returned via API:", data.length);
  }
}
main();
