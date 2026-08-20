import puppeteer from 'puppeteer';

const [, , cmd, ...rest] = process.argv;
const SHOT_DIR = process.env.SHOT_DIR || '.';

// Several classic <script>/<link> tags in public/index.html (AdminLTE template)
// point at external CDNs (unpkg, jsdelivr, ionicframework, fonts.googleapis). On a
// machine behind a corporate proxy that blackholes those hosts, the blocking
// <script src> for one of them stalls forever and document.readyState never leaves
// "loading" — React never mounts, and load/domcontentloaded never fire. Block them
// at the network layer; the app renders fine without them (icons/fonts fall back).
const BLOCK_HOSTS = ['cdn.jsdelivr.net', 'code.ionicframework.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

async function withPage(fn) {
  const browser = await puppeteer.launch({
    headless: true,
    // No bundled Chromium is installed (npx puppeteer browsers install chrome was
    // never run) — reuse the system Chrome install instead.
    executablePath: process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--proxy-bypass-list=<-loopback>'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (BLOCK_HOSTS.some((h) => r.url().includes(h))) r.abort();
      else r.continue();
    });
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    await fn(page, browser);
  } finally {
    await browser.close();
  }
}

async function shootTo(page, url, outfile) {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.screenshot({ path: `${SHOT_DIR}/${outfile}` });
  console.log(`saved ${SHOT_DIR}/${outfile} (title: ${await page.title()}, url: ${page.url()})`);
}

async function cmdShot() {
  const [url, outfile] = rest;
  await withPage((page) => shootTo(page, url, outfile));
}

async function cmdLoginShot() {
  // Injects a synthetic auth session via evaluateOnNewDocument (runs before ANY
  // page script, including the app's own bundle) then loads a protected route.
  //
  // Must NOT be done by navigating to /sign_in first and setting localStorage
  // there: SignIn's mount effect (sign_in.jsx) unconditionally clears the session
  // (LOGIN_PASSED="no", removes token) as an anti-stale-session guard, so anything
  // written before that mount effect runs gets wiped. evaluateOnNewDocument sets
  // localStorage before the SPA boots at all, so there's no SignIn mount to race.
  //
  // See SKILL.md for how the JWT is minted with the backend's own JWT_SECRET, and
  // why the empno must belong to a real row in eng_system.users (some routes the
  // app calls on mount, e.g. update-user-theme, 401 for a non-existent empno, and
  // the frontend's global axios interceptor force-logs-out on ANY 401).
  const [url, token, empno, name, role, department, outfile] = rest;
  await withPage(async (page) => {
    await page.evaluateOnNewDocument(
      (t, empno, name, role, department) => {
        const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        localStorage.setItem('token', t);
        localStorage.setItem('tokenExpiresAt', future);
        localStorage.setItem('LOGIN_PASSED', 'yes');
        localStorage.setItem('USER_EMPNO', empno);
        localStorage.setItem('USER_NAME', name);
        localStorage.setItem('ROLE', role);
        localStorage.setItem('USER_DEPARTMENT', department);
        localStorage.setItem('USER_AUTH', department);
        localStorage.setItem('USER_PERMS', '[]');
        localStorage.setItem('USER_INFO', '{}');
      },
      token, empno, name, role, department
    );
    await shootTo(page, url, outfile);
  });
}

/** The session injection `login-shot` uses, factored out so `login-do` shares it. */
function injectSession(page, token, empno, name, role, department) {
  return page.evaluateOnNewDocument(
    (t, e, n, r, d) => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      localStorage.setItem('token', t);
      localStorage.setItem('tokenExpiresAt', future);
      localStorage.setItem('LOGIN_PASSED', 'yes');
      localStorage.setItem('USER_EMPNO', e);
      localStorage.setItem('USER_NAME', n);
      localStorage.setItem('ROLE', r);
      localStorage.setItem('USER_DEPARTMENT', d);
      localStorage.setItem('USER_AUTH', d);
      localStorage.setItem('USER_PERMS', '[]');
      localStorage.setItem('USER_INFO', '{}');
    },
    token, empno, name, role, department
  );
}

async function cmdLoginDo() {
  // Loads a protected route, types into a field, clicks something, waits, shoots.
  // `login-shot` only proves a route renders; most of what is worth checking is
  // what the page does after an input — a search that returns rows, a form that
  // saves. Selectors are CSS, so prefer placeholder/aria attributes over class
  // names, which Ant Design regenerates.
  //
  //   login-do <url> <jwt> <empno> <name> <role> <dept> <typeSel> <text> <clickSel> <waitSel> <waitMs> <out.png>
  //
  // Pass "-" for any of typeSel / clickSel / waitSel to skip that step.
  const [url, token, empno, name, role, department,
         typeSel, text, clickSel, waitSel, waitMs, outfile] = rest;
  await withPage(async (page) => {
    await injectSession(page, token, empno, name, role, department);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    if (typeSel && typeSel !== '-') {
      await page.waitForSelector(typeSel, { timeout: 30000 });
      await page.click(typeSel);
      await page.type(typeSel, text ?? '');
    }
    if (clickSel && clickSel !== '-') {
      await page.waitForSelector(clickSel, { timeout: 30000 });
      await page.click(clickSel);
    }
    if (waitSel && waitSel !== '-') {
      // A result table can take seconds — the search fans out over every machine.
      await page.waitForSelector(waitSel, { timeout: Number(waitMs) || 60000 });
    } else {
      await new Promise((r) => setTimeout(r, Number(waitMs) || 3000));
    }
    await page.screenshot({ path: `${SHOT_DIR}/${outfile}`, fullPage: true });
    console.log(`saved ${SHOT_DIR}/${outfile} (title: ${await page.title()}, url: ${page.url()})`);
  });
}

const commands = { shot: cmdShot, 'login-shot': cmdLoginShot, 'login-do': cmdLoginDo };
const fn = commands[cmd];
if (!fn) {
  console.error('Usage: node .claude/skills/run-engineersystem/driver.mjs shot <url> <outfile.png>');
  console.error('       node .claude/skills/run-engineersystem/driver.mjs login-shot <url> <jwt> <empno> <name> <role> <department> <outfile.png>');
  console.error('       node .claude/skills/run-engineersystem/driver.mjs login-do <url> <jwt> <empno> <name> <role> <department> <typeSel> <text> <clickSel> <waitSel> <waitMs> <outfile.png>');
  process.exit(1);
}
await fn();
