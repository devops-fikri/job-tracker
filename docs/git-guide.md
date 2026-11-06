# Git & GitHub guide

The commands used to commit and publish this repo, with notes on why each step matters.

## 1. Check before you commit

```sh
git status --short                  # what changed (M=modified, A=added, ??=untracked)
git diff --cached --name-only       # files staged for the next commit
cat .gitignore                      # what git will never track (.env, backups/, data/)
git check-ignore -v .env            # prove a file is ignored, and by which rule
```

## 2. Hunt for secrets before pushing (most important habit)

```sh
git grep --cached -nIE '(PASSWORD|SECRET|TOKEN|API_KEY)\s*=\s*\S{12,}'   # long values next to secret-ish names
git diff --cached --name-only | grep -iE '\.env$|\.pem$|\.dump$|secret' # dangerous filenames
P=$(grep '^POSTGRES_PASSWORD=' .env | cut -d= -f2); git grep --cached -lF "$P" || echo clean
```

The last line greps for the *actual* password in staged files. It's the surest check, because it searches for the real value instead of guessing at patterns.

## 3. Create a repo and commit

```sh
git init -b main                    # new repo with default branch "main"
git add -A                          # stage everything that isn't ignored
git commit -m "Short summary" -m "Longer body explaining why"
git log --oneline --stat            # review what went in
```

**Nested repo gotcha:** `web/` originally had its own `.git` folder (from `create-next-app`). Git would treat it as a separate repo and store only a pointer to it, not its files. Moving `web/.git` out first made it ordinary files in the main repo.

## 4. Publish to GitHub with `gh`

```sh
gh auth status                                          # which account you're logged in as
gh repo create devops-fikri/job-tracker --public \
  --source . --remote origin --push \
  --description "..."                                   # create + add remote + push in one step
git remote -v                                           # confirm where "origin" points
git log --oneline origin/main                           # confirm GitHub has your commits
```

Without `gh`: create the repo on github.com, then

```sh
git remote add origin git@github.com:devops-fikri/job-tracker.git
git push -u origin main
```

## 5. Repo security settings

```sh
# enable secret scanning + push protection (blocks pushes containing known token formats)
gh api -X PATCH repos/devops-fikri/job-tracker --input - <<'JSON'
{"security_and_analysis":{"secret_scanning":{"status":"enabled"},
 "secret_scanning_push_protection":{"status":"enabled"}}}
JSON

gh api repos/devops-fikri/job-tracker --jq '.visibility, .security_and_analysis'

# flip visibility if needed
gh repo edit --visibility private --accept-visibility-change-consequences
```

## 6. Everyday workflow

```sh
git status && git diff              # 1. review your changes
git add <files>                     # 2. stage on purpose (avoid blind `add -A` once secrets exist)
                                    # 3. run the secret checks from section 2
git commit -m "..."                 # 4. commit
git log origin/main..HEAD           # 5. see exactly which commits will go out
git push                            # 6. push (upstream is already set)
```

## Rules

1. **Secrets live only in `.env`.** Commit `.env.example` with placeholder values.
2. **A pushed secret counts as leaked.** Deleting it in a later commit doesn't remove it from history, and public repos get scraped within minutes. Rotate it (generate a new one) immediately.
3. **Keep commits small,** with a message that says *why*, not just what.
4. **Check before you push.**
