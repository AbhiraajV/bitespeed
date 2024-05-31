import express from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

app.get("/identify", async (req, res) => {
  try {
    const { email, phonenumber } = req.body;
    // const posts = await prisma.post.findMany();
    res.json({ email, phonenumber });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Error fetching posts" });
  }
});

app.listen(8888, () => {
  console.log(`Server listening on port ${8888}`);
});
