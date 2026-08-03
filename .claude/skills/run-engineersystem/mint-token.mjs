// Mints a JWT signed with the backend's own JWT_SECRET, for read-only local
// smoke-testing without needing real employee login credentials. See SKILL.md.
//
// Usage: node .claude/skills/run-engineersystem/mint-token.mjs <empno> <name> <role> <department>
//
// Run from apps/ENG-Backend so dotenv picks up its .env (JWT_SECRET).
import jwt from 'jsonwebtoken';
// dotenv prints a "[dotenv@x] injecting env..." tip line to stdout by default,
// which corrupts `TOKEN=$(node mint-token.mjs ...)` capture (see SKILL.md
// Gotchas). { quiet: true } suppresses it.
import { config } from 'dotenv';
config({ quiet: true });

const [, , empno, name, role, department] = process.argv;
if (!empno) {
  console.error('Usage: node mint-token.mjs <empno> <name> <role> <department>');
  process.exit(1);
}

const payload = { empno, name: name || empno, department: department || 'AD', group: department || 'AD', role: role || 'admin', perms: [] };
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
process.stdout.write(token);
