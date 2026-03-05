#!/usr/bin/env node
/**
 * Generate an Apple Music API developer token (JWT signed with ES256).
 * See: https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens
 *
 * Required env:
 *   APPLE_TEAM_ID   - Team ID (iss)
 *   APPLE_KEY_ID   - Key ID (kid)
 *   APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_PATH - .p8 key content or path
 *
 * Usage: node scripts/generate-developer-token.mjs
 * Output: signed JWT to stdout
 */

import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({path: envPath});
}

const TEAM_ID = process.env.APPLE_TEAM_ID;
const KEY_ID = process.env.APPLE_KEY_ID;
const PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
const PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH;

function getPrivateKey() {
  if (PRIVATE_KEY) {
    return PRIVATE_KEY;
  }
  if (PRIVATE_KEY_PATH) {
    const path = resolve(process.cwd(), PRIVATE_KEY_PATH);
    return readFileSync(path, 'utf8');
  }
  return null;
}

function main() {
  if (!TEAM_ID || !KEY_ID) {
    console.error(
      'Missing APPLE_TEAM_ID or APPLE_KEY_ID. Set env vars or use .env (see docs/DEVELOPER_TOKEN_SETUP.md).'
    );
    process.exit(1);
  }

  const key = getPrivateKey();
  if (!key) {
    console.error(
      'Missing APPLE_PRIVATE_KEY or APPLE_PRIVATE_KEY_PATH. Do not commit the .p8 file.'
    );
    process.exit(1);
  }

  const now = Math.floor(Date.now() / 1000);
  const maxExpDelta = 15777000; // 6 months in seconds
  const payload = {
    iss: TEAM_ID,
    iat: now,
    exp: now + maxExpDelta,
  };

  const token = jwt.sign(payload, key, {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: KEY_ID,
    },
  });

  console.log(token);
}

main();
