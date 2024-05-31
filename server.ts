import express from "express";
import { PrismaClient } from "@prisma/client";
import bodyParser from "body-parser";

const prisma = new PrismaClient();
const app = express();

app.use(bodyParser.json());

app.get("/identify", async (req, res) => {
  try {
    const { email = null, phoneNumber = null } = req.body;
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
    });

    if (contacts.length === 0) {
      const createContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "PRIMARY",
        },
      });
      return res.json({ contacts: [createContact], request: req.body });
    }
    return res.json({ email, phoneNumber });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ message: "Error fetching posts" });
  }
});

app.listen(8888, () => {
  console.log(`Server listening on port ${8888}`);
});
