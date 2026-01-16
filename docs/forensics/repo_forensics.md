# Repo Forensics Report

## Phase 0.1 - Current repo facts (C:\Users\Paulin\PaymentsClover\Payments)

Command: dir /a

Output:
```
 Volume in drive C is Windows
 Volume Serial Number is 0007-DDBC

 Directory of C:\Users\Paulin\PaymentsClover\Payments

2026-01-07  09:12 PM    <DIR>          .
2026-01-14  12:15 AM    <DIR>          ..
2026-01-16  04:22 PM    <DIR>          .git
2026-01-07  09:12 PM                10 README.md
               1 File(s)             10 bytes
               3 Dir(s)  80,323,256,320 bytes free
```

Command: git rev-parse --show-toplevel

Output:
```
C:/Users/Paulin/PaymentsClover/Payments
```

Command: git status

Output:
```
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

Command: git log --oneline --decorate --max-count=20

Output:
```
0205863 (HEAD -> main, origin/main, origin/HEAD) Initial commit
```

Command: git ls-tree -r HEAD

Output:
```
100644 blob c32dd525f8284e75edbd5ca000f97dab3b6af0f7	README.md
```

Command: git remote -v

Output:
```
origin	https://github.com/paulin22/Payments.git (fetch)
origin	https://github.com/paulin22/Payments.git (push)
```

Command: git branch -vv

Output:
```
* main 0205863 [origin/main] Initial commit
```

Command: git remote show origin

Output:
```
* remote origin
  Fetch URL: https://github.com/paulin22/Payments.git
  Push  URL: https://github.com/paulin22/Payments.git
  HEAD branch: main
  Remote branch:
    main tracked
  Local branch configured for 'git pull':
    main merges with remote main
  Local ref configured for 'git push':
    main pushes to main (up to date)
```

## Phase 0.3 - Ignore checks

Command: type .gitignore

Output:
```
The system cannot find the file specified.
```

Command: type .git\info\exclude

Output:
```
# git ls-files --others --exclude-from=.git/info/exclude
# Lines that start with '#' are comments.
# For a project mostly in C, the following would be a good set of
# exclude patterns (uncomment them if you want to use them):
# *.[oa]
# *~
```

Command: git config --get core.excludesfile

Output:
```
<empty>
```

## Phase 1.1 - Marker search from C:\Users\Paulin

Command: dir /s /b package.json

Output summary:
- 1830 results, all in system/editor directories (e.g., C:\Users\Paulin\.vscode, C:\Users\Paulin\.antigravity, VS Code install, AppData)
- No application repo candidates under C:\Users\Paulin\Documents or C:\Users\Paulin\Desktop

Command: dir /s /b pnpm-lock.yaml

Output:
```
C:\Users\Paulin\AppData\Local\Programs\Antigravity\resources\app\node_modules\@iconify\types\pnpm-lock.yaml
```

Command: dir /s /b yarn.lock

Output:
```
C:\Users\Paulin\AppData\Local\Pub\Cache\hosted\pub.dev\node_preamble-2.0.2\yarn.lock
C:\Users\Paulin\Downloads\phpMyAdmin-5.2.2-all-languages\phpMyAdmin-5.2.2-all-languages\yarn.lock
```

Command: dir /s /b Cargo.toml

Output summary:
- Results are all in Rust cargo registry (C:\Users\Paulin\.cargo\registry\...)
- No application Cargo.toml under user projects

Command: dir /s /b manage.py

Output:
```
File Not Found
```

Command: dir /s /b docker-compose.yml

Output:
```
C:\Users\Paulin\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\sqlx-0.7.4\tests\docker-compose.yml
C:\Users\Paulin\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\sqlx-0.8.6\tests\docker-compose.yml
```

Command: dir /s /b AGENTS.md

Output:
```
C:\Users\Paulin\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\zerocopy-0.8.31\AGENTS.md
C:\Users\Paulin\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\zerocopy-0.8.33\AGENTS.md
```

Command: dir /s /b agents.md

Output:
```
C:\Users\Paulin\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\zerocopy-0.8.31\AGENTS.md
C:\Users\Paulin\.cargo\registry\src\index.crates.io-1949cf8c6b5b557f\zerocopy-0.8.33\AGENTS.md
```

## Phase 1.2 - Other git repos (C:\Users\Paulin)

Command: dir /s /b .git | findstr /i "C:\\Users\\Paulin"

Output:
```
C:\Users\Paulin\Downloads\flutter_windows_3.35.3-stable\flutter\.git
```

## Additional discovery outside C:\Users\Paulin

Found git repos under C:\central_books:
- C:\central_books\Central-Books\.git
- C:\central_books\Central-Books-1\.git

Key facts (Central-Books-1):
- Remote: https://github.com/MikeNzmbh/Central-Books.git
- Contains Rust API, React apps, companion modules, and docs

## Conclusion (Root Cause)

- H1 (Wrong folder/repo): TRUE. The Payments repo is an empty clone with only README.md and a single "Initial commit".
- H2 (Wrong remote): TRUE. The real code lives in C:\central_books\Central-Books-1 (and C:\central_books\Central-Books), both pointing to a different GitHub repo (MikeNzmbh/Central-Books).
- H3 (Never committed): NOT supported (Payments repo is clean and contains only README.md).
- H4 (Ignored): NOT supported (.gitignore missing, global excludes unset).
- H5 (Other branch/clone): TRUE; the codebase is in a different clone (Central-Books-1), not in Payments.

Action: recover the real code from C:\central_books\Central-Books-1, repoint to the correct GitHub repo (paulin22/Payments), and push on a new branch.
