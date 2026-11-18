# 📚 BookNook Server

## Description

This is the backend of BookNook. It stores all books and borrows in MongoDB and protects the private routes with a JWT login token created by Better Auth on the client.

## Technologies Used

Node.js, Express.js, MongoDB, JWT (jose), CORS, dotenv

## Key Features

1. **8 API routes** – get all books, get one book, add, update and delete a book, borrow a book, get my borrows and return a book.
2. **Owner only edit and delete** – a user can only update or delete the books they added.
3. **Available copies** – borrowing reduces the copies by 1 with `$inc`, returning gives the copy back, and a book with 0 copies cannot be borrowed.
4. **No double borrow** – the same user cannot borrow the same book twice at the same time.
5. **Clean error messages** – every error sends a clear message that the client shows in a toast.

