const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB URI
const uri =
   "mongodb+srv://finance-management:63qWYOv4Y3pFuvLF@ggbd.znymale.mongodb.net/?appName=ggbd";

// Create a MongoClient instance
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   },
});

async function run() {
   try {
      await client.connect();
      const db = client.db("finance-management");
      const allFinance = db.collection("personal-finance");

      console.log("Connected to MongoDB successfully!");

      // ------------------------------
      // GET all transactions (for admin/test)
      // ------------------------------
      app.get("/alluser", async (req, res) => {
         try {
            const result = await allFinance.find().toArray();
            res.send(result);
         } catch (error) {
            console.error("Error fetching transactions:", error);
            res.status(500).send({ message: "Error fetching transactions" });
         }
      });

      // ------------------------------
      // POST: Add new transaction
      // ------------------------------
      app.post("/transactions", async (req, res) => {
         try {
            const transaction = req.body;

            // Basic validation
            if (
               !transaction.type ||
               !transaction.category ||
               !transaction.amount ||
               !transaction.date ||
               !transaction.userEmail
            ) {
               return res
                  .status(400)
                  .send({ message: "Missing required transaction fields" });
            }

            const result = await allFinance.insertOne(transaction);
            res.send(result);
         } catch (error) {
            console.error("Error inserting transaction:", error);
            res.status(500).send({ message: "Failed to add transaction" });
         }
      });

      // ------------------------------
      // GET: Get transactions for a user
      // ------------------------------
      app.get("/transactions", async (req, res) => {
         try {
            const email = req.query.email;
            if (!email) {
               return res.status(401).send({ message: "Email query is required" });
            }
            const result = await allFinance
               .find({ userEmail: email })
               .sort({ date: -1 })
               .toArray();
            res.send(result);
         } catch (error) {
            console.error("Error fetching user transactions:", error);
            res.status(500).send({ message: "Error fetching user transactions" });
         }
      });

      // ------------------------------
      // GET: Single transaction by ID
      // ------------------------------
      app.get("/transactions/:id", async (req, res) => {
         try {
            const id = req.params.id;
            const result = await allFinance.findOne({ _id: new ObjectId(id) });
            if (!result) {
               return res.status(404).send({ message: "Transaction not found" });
            }
            res.send(result);
         } catch (error) {
            console.error("Error fetching transaction:", error);
            res.status(500).send({ message: "Error fetching transaction" });
         }
      });


      // PUT: Update transaction

      app.put("/transactions/:id", async (req, res) => {
         try {
            const id = req.params.id;
            const updatedData = req.body;

            // Only allow editable fields
            const { type, category, amount, description, date, userEmail } =
               updatedData;

            // Fetch existing transaction
            const transaction = await allFinance.findOne({ _id: new ObjectId(id) });
            if (!transaction) {
               return res.status(404).send({ message: "Transaction not found" });
            }

            // Authorization: Only owner can update
            if (transaction.userEmail !== userEmail) {
               return res.status(403).send({ message: "Not authorized" });
            }

            const updateDoc = {
               $set: { type, category, amount, description, date },
            };

            const result = await allFinance.updateOne(
               { _id: new ObjectId(id) },
               updateDoc
            );

            res.send(result);
         } catch (error) {
            console.error("Error updating transaction:", error);
            res.status(500).send({ message: "Failed to update transaction" });
         }
      });

      // DELETE: Delete transaction
      app.delete("/transactions/:id", async (req, res) => {
         try {
            const id = req.params.id;
            const userEmail = req.query.userEmail; // get from query

            if (!userEmail) return res.status(401).send({ message: "User email required" });

            const transaction = await allFinance.findOne({ _id: new ObjectId(id) });
            if (!transaction) return res.status(404).send({ message: "Transaction not found" });

            if (transaction.userEmail !== userEmail)
               return res.status(403).send({ message: "Not authorized" });

            const result = await allFinance.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
         } catch (error) {
            console.error("Error deleting transaction:", error);
            res.status(500).send({ message: "Failed to delete transaction" });
         }
      });

      // Ping MongoDB
      await client.db("admin").command({ ping: 1 });
      console.log(" Pinged MongoDB successfully!");
   } catch (err) {
      console.error("MongoDB connection failed:", err);
   }
}

run().catch(console.dir);

// ------------------------------
// Root route
// ------------------------------
app.get("/", (req, res) => {
   res.send("Your Finance API is running smoothly!");
});

// ------------------------------
// Start Server
// ------------------------------
app.listen(port, () => {
   console.log(`Server running at http://localhost:${port}`);
});
