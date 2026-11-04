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

app.get("/", (req, res) => {
  res.send("BookNook server is running!");
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`BookNook server is running on port ${PORT}`);
  });
}

export default app;
