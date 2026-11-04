# 📚 BookNook Server

Express.js + MongoDB API for **BookNook**, a small online library.

**Client repository:** https://github.com/your-username/booknook-client  
**Live API:** https://your-booknook-server.vercel.app

## API routes

| Method | Route | Access | Description |
|---|---|---|---|
| GET | `/books` | public | All books, newest first. `?limit=6` for new arrivals, `?email=` for one user's books |
| GET | `/books/:id` | token | One book |
| POST | `/books` | token | Add a book (saves the added date) |
| PATCH | `/books/:id` | token (owner) | Update a book |
| DELETE | `/books/:id` | token (owner) | Delete a book |
| POST | `/borrows` | token | Borrow a book (`$inc` copies by -1, no double borrow) |
| GET | `/borrows` | token | Borrows of the logged in user |
| DELETE | `/borrows/:id` | token | Return a book (`$inc` copies by +1) |

Protected routes need an `Authorization: Bearer <token>` header. The token is the
JWT created by BetterAuth on the client; the server checks it with the public keys
from `CLIENT_URL/api/auth/jwks` (`jose`).

## Run locally

```bash
npm install
cp .env.example .env   # then fill in the values
npm run dev
```

```env
MONGODB_URI=
CLIENT_URL=http://localhost:3000
```

The server starts on port `8000`. Deploy on Vercel with the same environment
variables (`vercel.json` is included).
