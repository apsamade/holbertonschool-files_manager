# holbertonschool-files_manager

Summary project of the back-end trimester: authentication, NodeJS, MongoDB, Redis, pagination and background processing.

The goal is a simple platform to upload and view files:

- User authentication via a token
- List all files
- Upload a new file
- Change permission of a file
- View a file
- Generate thumbnails for images

## Requirements

- Ubuntu 20.04 LTS, Node.js 20.x
- Redis and MongoDB running locally
- Code linted with ESLint (`npm run lint <file>`)

Install dependencies with `npm install`, then run a script with `npm run dev <file>.js`.

## Files

| File | Description |
| --- | --- |
| `utils/redis.mjs` | `RedisClient` class (`isAlive`, `get`, `set` with expiration, `del`) and exported `redisClient` instance |
| `utils/db.mjs` | `DBClient` class (`isAlive`, `nbUsers`, `nbFiles`) and exported `dbClient` instance |
| `utils/auth.js` | Helpers to retrieve the user from the `X-Token` header |
| `server.js` | Express server listening on `PORT` (default 5000), loads `routes/index.js` |
| `routes/index.js` | All API endpoints |
| `controllers/AppController.js` | `GET /status`, `GET /stats` |
| `controllers/UsersController.js` | `POST /users`, `GET /users/me` |
| `controllers/AuthController.js` | `GET /connect` (Basic auth → token), `GET /disconnect` |
| `controllers/FilesController.js` | `POST /files`, `GET /files/:id`, `GET /files`, `PUT /files/:id/publish`, `PUT /files/:id/unpublish`, `GET /files/:id/data` |
| `worker.js` | Bull `fileQueue` worker generating 500/250/100 thumbnails for images |

## Running

```bash
npm run start-server   # API on port 5000
npm run start-worker   # thumbnail worker
```

Environment variables: `PORT`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `FOLDER_PATH` (default `/tmp/files_manager`).
