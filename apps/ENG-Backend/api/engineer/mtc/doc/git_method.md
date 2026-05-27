// 1. add
git add .

// 2. commit
git commit -m "comment"

// ============================== //

// 3. push to origin mtc
git push origin mtc

// 4. pull from origin dev
git checkout dev
git pull origin dev

// 5. merge to origin dev
git merge mtc
(esc => type :wq)

// 6. push to origin dev
git push origin dev

// ============================== //

// 3. push to github mtc
git push github mtc

// 4. pull from github dev
git checkout dev
git pull github dev

// 5. merge with github
git merge mtc
type :wq

// 6. push to github
git push github dev

// 7. push to github dev:main --force
git push github dev:main --force

// ============================== //