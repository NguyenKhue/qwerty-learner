# Running a stable build on this computer

The app keeps all of your learning data in **one folder on this computer** (`qwerty.db` plus automatic backups). A small program, the
**data server**, owns that folder; the app in the browser talks to it. This guide sets up a **stable** copy of the app that runs
next to the development copy and never changes unless you decide to update it.

|                        | Development                                    | Stable                                   |
| ---------------------- | ---------------------------------------------- | ---------------------------------------- |
| Start with             | `yarn dev:full`                                | `yarn stable:start` (or at login, below) |
| Address                | `http://localhost:5173`                        | `http://localhost:4173`                  |
| Data folder            | `./.dev-data` in the project (never committed) | the folder you choose                    |
| Changes with your code | immediately                                    | only when you run `yarn stable:build`    |

Needs Node 22.13 or newer (`node --version`).

## 1. One-time setup

Choose where your real data will live, outside the project folder, for example `~/Documents/qwerty-data`, and write your settings:

```bash
mkdir -p ~/.config/qwerty-learner
cat > ~/.config/qwerty-learner/stable.json <<'JSON'
{ "dataDir": "~/Documents/qwerty-data" }
JSON
```

Optional keys: `"port"` (default 4173) and `"installDir"` (default `~/stable/qwerty`, where the built files go). `dataDir` must not
be inside `installDir`, and the server refuses a data folder inside the project folder.

Build the stable copy from a committed branch or tag (uncommitted work is never included):

```bash
yarn stable:build --ref feat/file-storage
```

Try it:

```bash
yarn stable:start
```

then open `http://localhost:4173`. Stop it with Ctrl+C.

## 2. Moving the data you already have

The data you have studied so far lives in your browser, at the address you used until now (for example `localhost:5173`).

1. **Make a safety copy first.** In the old version of the app: Setting, Data, Export. Keep that `.gz` file.
2. Start the stable server and open its address in the **same browser**. It shows "Move your data to the data folder" with what it
   found. Check the numbers, then press **Move my data**.
3. The move copies everything into a staging file, compares the counts with what the browser sent, and only then writes it into the
   data folder in one step. If anything fails, nothing is changed. It also makes a backup right after.
4. Look around: My Sets, Flashcards (the due counts), the dashboard streak, the error book.
5. The old copy in the browser is **not deleted**. Keep it for a while; when you are happy, delete it from the notice the app shows,
   or never.

After moving, do not keep studying in the old version of the app: it still reads its own copy in the browser and would not know about
the data folder. Use the stable address (or the development copy with its own throwaway data).

## 3. Start at login

```bash
yarn stable:launchd > ~/Library/LaunchAgents/vn.khue.qwerty-learner.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/vn.khue.qwerty-learner.plist
```

It starts at login and starts again if it stops with an error. Logs: `~/Library/Logs/qwerty-learner.log`.

```bash
launchctl kickstart -k gui/$(id -u)/vn.khue.qwerty-learner   # restart (after yarn stable:build)
launchctl bootout gui/$(id -u)/vn.khue.qwerty-learner        # stop and do not start at login
```

Rewrite the plist (`yarn stable:launchd > …`) and `bootout` then `bootstrap` again if you change `stable.json`.

## 4. Updating the stable copy

```bash
yarn stable:build --ref <branch or tag>
launchctl kickstart -k gui/$(id -u)/vn.khue.qwerty-learner
```

Shortcut for the usual case (builds `feat/study-modes` and restarts the launchd service): `yarn stable:update`.

The data folder is never touched by a build. `~/stable/qwerty/VERSION` says which commit is installed.

## 5. Backups and restoring

The server writes a backup of the day in `<data folder>/backups/` when it starts and checks again every hour. It keeps the last 14
days, the Sunday copies of the last 8 weeks, and never fewer than the 7 newest, whatever the clock says. A backup is also written
right after a move and before an import (`after-migration-…`, `before-import-…`).

To restore: stop the server, copy the file you want from `backups/` over `qwerty.db`, delete `qwerty.db-wal` and `qwerty.db-shm` if
they are there, start the server.

Setting, Data also has Export (a `.gz` you can keep anywhere, or import into another folder) and Import (replaces everything, after a
backup).

## 6. Developing with real data

`yarn dev:full` starts the data server on `./.dev-data` together with Vite. To try the development copy with a copy of your real data:

```bash
yarn data:copy-to-dev ~/Documents/qwerty-data          # shows what it would do
yarn data:copy-to-dev ~/Documents/qwerty-data --yes    # does it (stop the dev server first)
```

The copy is made from a consistent snapshot; the stable folder is only read. It refuses a source that is not a stable folder, a
target that is not a dev folder, and a dev folder with a running server.

## 7. A nicer address (optional)

`qwerty.localhost` works without editing any file (browsers send `*.localhost` to this computer). With [Caddy](https://caddyserver.com):

```
qwerty.localhost {
    reverse_proxy 127.0.0.1:4173
}
```

The data server accepts `localhost`, `127.0.0.1`, `[::1]` and names ending in `.localhost`, and listens on this computer only. It has
no password, so do not expose it to other computers.

## 8. When something is wrong

- **"The data server is not running"** in the app: start it (`yarn stable:start`, or `launchctl kickstart …`). The page continues by itself.
- **The server will not start, "LOCKED"**: another server uses this folder. Stop it first.
- **"ROLE_MISMATCH"**: a development server was pointed at the stable folder or the other way round. This is a safety stop.
- **"NEWER_SCHEMA"**: the folder was written by a newer version of the app; update the stable copy.
- **"CORRUPT"**: the database file is damaged; restore a backup (section 5).
- Static hosting (GitHub Pages, Docker) cannot serve this version of the app, because it needs the data server. Do not merge this
  branch into a branch that deploys to such a host.

## Measured on this machine (2026-10-20)

Database with 100,006 word records and 5,000 chapter records (13 MB), local requests:

| Operation                                   | Time                         |
| ------------------------------------------- | ---------------------------- |
| `words.add` (one write, `synchronous=FULL`) | 1-2 ms                       |
| `stats.summary`                             | 1 ms                         |
| `words.between` (30 days, 1 MB)             | 18 ms                        |
| `activity.times` (120 days, 1.4 MB)         | 33 ms                        |
| `words.wrong` (2 MB)                        | 45 ms                        |
| Export JSON (1.6 MB)                        | 0.27 s                       |
| Import of that export into an empty folder  | 0.92 s, reads back identical |

Fault checks: a second server on the same folder is refused (`LOCKED`), a stable server on a dev folder is refused (`ROLE_MISMATCH`), a damaged file is refused (`CORRUPT`), a higher `user_version` is refused (`NEWER_SCHEMA`). A folder whose `qwerty.db` was deleted starts empty (restore a file from `backups/` by hand).

## 7. Dictation (listening to YouTube videos)

The Dictation page plays a YouTube video one sentence at a time. The data server prepares a video the first time it is opened: it
fetches the subtitles with **yt-dlp** (no video is downloaded), splits them into sentences, takes the Vietnamese from YouTube when the
video offers it and asks the **Claude CLI** to translate the rest. Everything is cached in the data folder (`qwerty.db`), so a video
opens at once afterwards. Your progress in each video is kept there too.

Install yt-dlp once:

```bash
brew install yt-dlp
```

The `claude` command is the Claude Code CLI; you are already signed in to it.

launchd starts the stable server with a very short `PATH`, so it may not find either command. Name them in
`~/.config/qwerty-learner/stable.json`:

```json
{ "dataDir": "~/Library/Application Support/qwerty-learner", "ytDlpPath": "/opt/homebrew/bin/yt-dlp", "claudePath": "~/.local/bin/claude" }
```

Find the paths with `which yt-dlp` and `which claude`. Then rewrite the launchd file and restart (section 3). The development server
uses your shell's `PATH`, or `QWERTY_YT_DLP` and `QWERTY_CLAUDE`.
