// 1. add
git add .

// 2. commit
git commit -m "comment"

// 3. push to origin mtc
git push origin mtc

// ============================== //

// 4. pull from origin dev
git checkout dev
git pull origin dev

// 5. merge to origin dev
git merge mtc

// 6. push to origin dev
// git push origin dev

// 7. pull from origin dev
git checkout main
git pull origin main

// 8. merge to origin dev
git merge dev

// 9. push to origin dev
// git push origin main

// steps 6 and 9 are commented ON PURPOSE: merge mtc into dev/main locally,
// inspect, but hold the push — "origin main" is what actually deploys plbmp130.
// Push them only when ready to release:
//   git checkout dev  && git push origin dev
//   git checkout main && git push origin main
// To throw the local merge away instead and go back to matching the server:
//   git checkout dev  && git reset --hard origin/dev
//   git checkout main && git reset --hard origin/main

// apiUrl WILL conflict on the dev/main merge — mtc has plbmp118 uncommented,
// dev/main must keep plbmp130 uncommented (apps/ENG-Frontend/src/constance/constance.js).
// Resolve toward plbmp130, or run scripts/fix_constance_prod.ps1 after merging.

// before merging, see how far dev/main have drifted from mtc:
//   git fetch origin
//   git log --oneline origin/dev..mtc     (commits mtc has that dev doesn't)
//   git log --oneline mtc..origin/dev     (commits dev has that mtc doesn't)
//   git log --oneline origin/main..mtc
//   git log --oneline mtc..origin/main

// ============================== //

// 10. push to github mtc
git checkout mtc
git push github mtc

// 11. pull from github dev
git checkout dev
git pull github dev

// 12. merge with github
git merge mtc
type :wq

// 13. push to github
git push github dev

// 14. push to github dev:main --force
git push github dev:main --force

// ============================== //

//Aras token in console
JSON.parse(sessionStorage.getItem('oidc.user:http://wk10.kz.minebea.local/InnovatorServer/OAuthServer/:InnovatorClient')).access_token