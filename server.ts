import express from "express";
import { PrismaClient } from "@prisma/client";
import bodyParser from "body-parser";

const prisma = new PrismaClient();
const app = express();

app.use(bodyParser.json());
app.get("/clear", async (req, res) => {
  await prisma.contact.deleteMany({});
  return res.json("Cleared");
});
app.get("/identify", async (req, res) => {
  try {
    const { email = null, phoneNumber = null } = req.body;
    let contacts = await prisma.contact.findMany({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
      include: {
        MyPrimary: {
          select: {
            createdAt: true,
            email: true,
            phoneNumber: true,
            id: true,
            linkedId: true,
            linkPrecedence: true,
            Secondary: true,
          },
        },
        Secondary: { select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    let exactExists = false;
    let otherPrimaries: any[] = [];
    contacts.forEach((contact, index) => {
      exactExists =
        exactExists ||
        (contact.email === email && contact.phoneNumber === phoneNumber);
      otherPrimaries =
        contact.linkPrecedence === "PRIMARY" && index !== 0
          ? [...otherPrimaries, contact.id]
          : [...otherPrimaries];
    });

    let PRIMARY =
      contacts[0] && contacts[0].MyPrimary
        ? contacts[0].MyPrimary
        : contacts[0];
    console.log({ exactExists, otherPrimaries, PRIMARY });
    if (otherPrimaries) {
      await Promise.all(
        otherPrimaries.map(async (contact) => {
          await prisma.contact.update({
            where: { id: contact },
            data: {
              linkPrecedence: "SECONDARY",
              MyPrimary: { connect: { id: PRIMARY.id } },
            },
          });
        })
      );
    }
    if (!exactExists) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: contacts.length === 0 ? "PRIMARY" : "SECONDARY",
          MyPrimary:
            contacts.length === 0 ? undefined : { connect: { id: PRIMARY.id } },
        },
      });
    }

    contacts = await prisma.contact.findMany({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
      include: {
        MyPrimary: {
          select: {
            createdAt: true,
            email: true,
            phoneNumber: true,
            id: true,
            linkedId: true,
            linkPrecedence: true,
            Secondary: true,
          },
        },
        Secondary: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    PRIMARY =
      contacts[0] && contacts[0].MyPrimary
        ? contacts[0].MyPrimary
        : contacts[0];
    return res.json({
      contact: {
        primaryId: PRIMARY && PRIMARY.id,
        emails: removeDuplicates(
          contacts
            .map((contact) => contact.email)
            .filter((email) => email !== null)
        ),
        phoneNumbers: removeDuplicates(
          contacts
            .map((contact) => contact.phoneNumber)
            .filter((phoneNumber) => phoneNumber !== null)
        ),
        secondary:
          PRIMARY &&
          removeDuplicates(
            PRIMARY.Secondary.map((secondary) => secondary.id + "")
          ),
        secondaryEmails: PRIMARY && PRIMARY.Secondary,
      },
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Error fetching contacts" });
  }
});

app.listen(8888, () => {
  console.log(`Server listening on port ${8888}`);
});

// CASES:

// 1. either email or phN exists, then this new contact becomes secondary linked to primary
// 2. if none exist, new created
// 3. if there are multiple primary contacts then all but the oldest become 2ndary.
// 4. the exact combination of email and phone number exists, just return data then.
// 5. if either email or phonenumber is missing in existing data only that is populated.

// FUNCTIONS
type Data = {
  email: string;
  phoneNumber: string;
};
type FunctionOutput = {
  exists: Boolean;
  out: any;
};

function removeDuplicates(array: (string | null)[]): (string | null)[] {
  return array.filter((item, index) => array.indexOf(item) === index);
}
async function existsF({ email, phoneNumber }: Data): Promise<FunctionOutput> {
  console.log({ email, phoneNumber });
  if (!email || !phoneNumber) return { exists: false, out: [] };
  const exists = await prisma.contact.findUnique({
    where: {
      email_phoneNumber: {
        email,
        phoneNumber,
      },
    },
    include: {
      MyPrimary: true,
      Secondary: true,
    },
  });

  if (exists) {
    return { exists: true, out: exists };
  }
  const createContact = await prisma.contact.create({
    data: {
      email,
      phoneNumber,
      linkPrecedence: "PRIMARY",
    },
  });
  return {
    exists: false,
    out: {
      contact: {
        id: createContact.id,
        emails: [createContact.email],
        phoneNumber: [createContact.phoneNumber],
        secondary: [],
      },
      new: true,
    },
  };
}

