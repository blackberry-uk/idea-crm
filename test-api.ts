import fetch from 'node-fetch';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const token = process.env.TEST_TOKEN || "";
  const res = await fetch('http://localhost:3000/api/daily-todos', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text.slice(0, 500));
}
run();
