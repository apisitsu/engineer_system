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
git push origin dev

// 7. pull from origin dev
git checkout main
git pull origin main

// 8. merge to origin dev
git merge dev

// 9. push to origin dev
// git push origin main

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