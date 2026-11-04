import "dotenv/config";
import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
const PORT = process.env.PORT || 8000;

// how many days a user can keep a borrowed book
const BORROW_DAYS = 7;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

export async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("booknook");
const booksCollection = db.collection("books");
const borrowsCollection = db.collection("borrows");

// public keys of the client app (BetterAuth jwt plugin)
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

// check the Bearer token and keep the user info in req.user
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized access!" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.log(error);
    res.status(401).send({ message: "Invalid or expired token!" });
  }
};

// ---------------------------------------------------------------- books

// all books (public) - newest first, ?limit=6 for new arrivals, ?email= for my books
app.get("/books", async (req, res) => {
  const { limit, email } = req.query;

  const query = email ? { userEmail: email } : {};
  let cursor = booksCollection.find(query).sort({ createdAt: -1 });

  if (limit) {
    cursor = cursor.limit(Number(limit));
  }

  const result = await cursor.toArray();
  res.send(result);
});

// one book
app.get("/books/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid book id!" });
  }

  const result = await booksCollection.findOne({ _id: new ObjectId(id) });

  if (!result) {
    return res.status(404).send({ message: "Book not found!" });
  }

  res.send(result);
});

// add a book
app.post("/books", verifyToken, async (req, res) => {
  const { title, author, category, imageUrl, description, totalCopies } =
    req.body;

  const copies = Number(totalCopies);

  if (!title || !author || !category || !imageUrl || !description) {
    return res.status(400).send({ message: "Please fill in all the fields!" });
  }

  if (!Number.isInteger(copies) || copies < 1) {
    return res
      .status(400)
      .send({ message: "Total copies must be at least 1!" });
  }

  const book = {
    title,
    author,
    category,
    imageUrl,
    description,
    totalCopies: copies,
    availableCopies: copies,
    userName: req.user.name,
    userEmail: req.user.email,
    createdAt: new Date(),
  };

  const result = await booksCollection.insertOne(book);
  res.send(result);
});

// update a book (only the owner)
app.patch("/books/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { title, author, category, imageUrl, description, totalCopies } =
    req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid book id!" });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(id) });

  if (!book) {
    return res.status(404).send({ message: "Book not found!" });
  }

  if (book.userEmail !== req.user.email) {
    return res
      .status(403)
      .send({ message: "You can only update your own books!" });
  }

  const copies = Number(totalCopies);
  const borrowed = book.totalCopies - book.availableCopies;

  if (!Number.isInteger(copies) || copies < borrowed || copies < 1) {
    return res.status(400).send({
      message: `Total copies cannot be less than ${Math.max(borrowed, 1)}!`,
    });
  }

  const updatedBook = {
    title,
    author,
    category,
    imageUrl,
    description,
    totalCopies: copies,
    availableCopies: copies - borrowed,
  };

  const result = await booksCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedBook },
  );
  res.send(result);
});

// delete a book (only the owner)
app.delete("/books/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send({ message: "Invalid book id!" });
  }

  const book = await booksCollection.findOne({ _id: new ObjectId(id) });

  if (!book) {
    return res.status(404).send({ message: "Book not found!" });
  }

  if (book.userEmail !== req.user.email) {
    return res
      .status(403)
      .send({ message: "You can only delete your own books!" });
  }

  await borrowsCollection.deleteMany({ bookId: id });
  const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

// -------------------------------------------------------------- borrows

// borrow a book
app.post("/borrows", verifyToken, async (req, res) => {
  const { bookId } = req.body;

  if (!ObjectId.isValid(bookId)) {
    return res.status(400).send({ message: "Invalid book id!" });
  }

  // a user cannot borrow the same book two times at the same time
  const alreadyBorrowed = await borrowsCollection.findOne({
    bookId,
    userEmail: req.user.email,
  });

  if (alreadyBorrowed) {
    return res
      .status(409)
      .send({ message: "You have already borrowed this book!" });
  }

  // take one copy (only if a copy is still available)
  const book = await booksCollection.findOneAndUpdate(
    { _id: new ObjectId(bookId), availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { returnDocument: "after" },
  );

  if (!book) {
    return res
      .status(400)
      .send({ message: "This book is not available right now!" });
  }

  const borrowDate = new Date();
  const returnDate = new Date();
  returnDate.setDate(returnDate.getDate() + BORROW_DAYS);

  const borrow = {
    bookId,
    bookTitle: book.title,
    bookImage: book.imageUrl,
    userName: req.user.name,
    userEmail: req.user.email,
    borrowDate,
    returnDate,
  };

  const result = await borrowsCollection.insertOne(borrow);
  res.send(result);
});

app.get("/", (req, res) => {
  res.send("BookNook server is running!");
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`BookNook server is running on port ${PORT}`);
  });
}

export default app;
