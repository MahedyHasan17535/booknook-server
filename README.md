# 📚 BookNook Server

## Description

This is the backend of BookNook. It stores all books and borrows in MongoDB and protects the private routes with a JWT login token created by Better Auth on the client.

## Technologies Used

Node.js, Express.js, MongoDB, JWT (jose), CORS, dotenv

## Key Features

1. **8 API routes** – get all books, get one book, add, update and delete a book, borrow a book, get my borrows and return a book.
2. **New arrivals and my books** – books are sorted newest first, with `?limit=6` for new arrivals and `?email=` for one user's books.
3. **JWT protected routes** – every private route checks the `Authorization: Bearer <token>` header with the public keys from the client.
4. **Owner only edit and delete** – a user can only update or delete the books they added.
5. **Available copies** – borrowing reduces the copies by 1 with `$inc`, returning gives the copy back, and a book with 0 copies cannot be borrowed.
6. **No double borrow** – the same user cannot borrow the same book twice at the same time.
7. **Clean error messages** – every error sends a clear message that the client shows in a toast.

