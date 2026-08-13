---
paths:
  - "apps/ENG-Frontend/src/components/engineer/mtc_eng/cam/lib/workDb.js"
  - "apps/ENG-Frontend/src/components/engineer/mtc_eng/cam/stores/libraryStore.js"
  - "apps/ENG-Frontend/src/components/engineer/mtc_eng/cam/components/LibraryPanel.jsx"
---

# Move the CAD/CAM library between origins

The library lives in IndexedDB (database `cam-web`, stores `meta` + `data`), and
the browser scopes IndexedDB to an **origin** = scheme + host + **port**. Each of
these therefore has its own separate library, sharing nothing:

| origin | which app |
|---|---|
| `http://localhost:3100` | standalone cam-web (vite dev) |
| `http://localhost:3000` | EngineerSystem frontend (CRA dev) |
| `http://plbmp118`       | EngineerSystem dev server |
| `http://plbmp130`       | EngineerSystem production |

Nothing is lost when the list looks empty — it is still under the origin it was
saved on. Use the two snippets below to carry it across. Both go in the browser
DevTools **Console** (F12 → Console), on the origin named in the heading.

Both stores use an **inline key** (`keyPath: 'key'`), so records are written with
`put(value)` and no separate key argument — passing one throws.

---

## 1. EXPORT — run on the origin that HAS the files

Open the old app (e.g. `http://localhost:3100`), F12 → Console, paste, Enter.
It downloads `cam-library.json`.

```js
(async () => {
  // Do NOT open the database unless it already exists. Opening a missing one
  // CREATES it, empty and at version 1 — and because the app also opens at
  // version 1, its `onupgradeneeded` would then never fire and it could never
  // create its stores. That would break the library on this origin for good.
  const names = (await indexedDB.databases()).map(d => d.name);
  if (!names.includes('cam-web')) {
    console.warn('No CAD/CAM library on ' + location.origin + ' — open the app that HAS the files and run this there.');
    return;
  }
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('cam-web', 1);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  if (!db.objectStoreNames.contains('meta')) { db.close(); console.warn('Library database exists but is empty.'); return; }
  const all = (store) => new Promise((res, rej) => {
    const rq = db.transaction(store, 'readonly').objectStore(store).getAll();
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  const payload = { meta: await all('meta'), data: await all('data') };
  db.close();
  if (!payload.meta.length) { console.warn('The library on ' + location.origin + ' is empty.'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  a.download = 'cam-library.json';
  document.body.appendChild(a);   // a detached anchor is ignored by some browsers
  a.click();
  a.remove();
  console.log('exported ' + payload.meta.length + ' items: ' + payload.meta.map(m => m.name).join(', '));
})();
```

## 2. IMPORT — run on the EngineerSystem CAD/CAM page

**Upload to the server** (`cam_saved_work`) — *not* into the browser. Writing to
IndexedDB here would do nothing at all now: the app reads its list from
`/api/engineer/cam/library` and never looks at the local database.

Because the destination is the server, this only has to be done **once**, from
any one origin, and it follows you to every other one.

> **These land on YOUR OWN shelf**, under the login whose token the page is
> holding — `PUT /library` always saves privately, and there is no parameter that
> could make it do otherwise. That is the right default for carrying in a
> personal backlog. If some of it belongs to the whole shop, press **Share** on
> those items afterwards; there is no bulk publish, deliberately.
>
> It also means whoever runs this becomes the owner of everything in the file. If
> the export is somebody else's work, have *them* run it on their own login.

Open CAD/CAM (`/eng/mtc_eng/cam`) so the page has your login, F12 → Console,
paste, Enter, then pick the `cam-library.json`.

```js
(async () => {
  // Same origin works wherever nginx proxies /api/ (plbmp118, plbmp130). On the
  // CRA dev server (localhost:3000) the backend is elsewhere — set it explicitly:
  //   const API = 'http://localhost:2005/api/engineer/cam/library';
  const API = '/api/engineer/cam/library';

  const file = await new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'application/json,.json';
    i.onchange = () => res(i.files[0]);
    i.click();
  });
  const payload = JSON.parse(await file.text());
  const dataByKey = new Map(payload.data.map((d) => [d.key, d]));
  const token = localStorage.getItem('token');

  let ok = 0; const failed = [];
  for (const meta of payload.meta) {
    const r = await fetch(API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ meta, data: dataByKey.get(meta.key) ?? {} }),
    });
    if (r.ok) ok++; else failed.push(meta.name + ' → HTTP ' + r.status);
  }
  console.log('uploaded ' + ok + ' of ' + payload.meta.length + ' items');
  if (failed.length) console.warn('failed:', failed);
  location.reload();
})();
```

## Notes

- Upload **merges**: an item whose key already exists is overwritten (that is the
  same "saving over a name replaces it" rule the app uses), and everything else
  in the shared library is left alone.
- The export still reads the **old per-browser** database, so run it on whichever
  origin the work was saved on — usually `localhost:3100`. The import goes to the
  server, so it is one-and-done.
- If the export says "No CAD/CAM library on …", you are on the wrong page — it
  deliberately does nothing rather than create an empty database.
- `lib/workDb.js` is kept in the codebase only so this export still has something
  to read. Nothing in the running app uses it any more.
