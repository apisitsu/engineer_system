// 1. add
git add .

// 2. commit
git commit -m "comment"

// 3. push to origin
git push origin feature/plbmp118

// 4. push to github
git push github feature/plbmp118

// 5. pull from github
git checkout dev
git pull github dev

// 6. merge with github
git merge feature/plbmp118

// 7. push to github
git push github dev

// 8. push to github dev:main --force
git push github dev:main --force

//////////////////////////////

// 9. pull from origin
git checkout dev
git pull origin dev

// 10. merge
git merge feature/plbmp118

// 11. push to origin
git push origin dev