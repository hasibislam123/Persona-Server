require('dotenv').config()
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");


const serviceAccount = require("./serviceKey.json");
const app = express();
const port = process.env.PORT || 3000;

// Middleware  
app.use(cors());
app.use(express.json());

admin.initializeApp({
   credential: admin.credential.cert(serviceAccount)
});


// MongoDB URI
const uri =
   `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}.znymale.mongodb.net/?appName=ggbd`;
const client = new MongoClient(uri, {
   serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});


// middlware
const middlware = async (req, res, next) => {
   const authorization = (req.headers.authorization)
   if (!authorization) {
      res.status(401).send({
         message: 'unauthorized access. Token not found '
      })
   }
   const token = authorization.split(' ')[1]

   try {
      const decode = await admin.auth().verifyIdToken(token);
      console.log(decode)
      next()
   }
   catch (error) {
      res.status(401).send({ message: 'unauthorized access.' })
   }

}


let transactionsCollection;

async function run() {
   try {
      // await client.connect();
      const db = client.db("finance-management");
      const transactionsCollection = db.collection("personal-finance");

      console.log("Connected to MongoDB successfully!");

      // Root route
      app.get("/",  (req, res) => res.send(" Finance API is running!"));

      //  GET all users' transactions (for testing/admin)
      app.get("/alluser",  async (req, res) => {
         try {
            const result = await transactionsCollection.find().toArray();
            res.send(result);
         } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Error fetching transactions" });
         }
      });

      // POST: Add a new transaction
      app.post("/transactions", async (req, res) => {
         try {
            const { type, category, amount, description, date, userEmail, userName } = req.body;

            if (!type || !category || !amount || !date || !userEmail) {
               return res.status(400).send({ message: " Missing required fields" });
            }

            const numericAmount = parseFloat(amount);
            if (isNaN(numericAmount)) {
               return res.status(400).send({ message: "Amount must be a number" });
            }

            const newTransaction = {
               type,
               category,
               amount: numericAmount,
               description: description || "",
               date,
               userEmail: userEmail.trim(),
               userName: userName?.trim() || "",
            };

            const result = await transactionsCollection.insertOne(newTransaction);
            res.send(result);
         } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Failed to add transaction" });
         }
      });

      //  GET: User transactions (List)
      app.get("/transactions", async (req, res) => {
         try {
            const email = req.query.email;
            if (!email) return res.status(400).send({ message: "Email is required" });

            const result = await transactionsCollection.find({ userEmail: email }).sort({ date: -1 }).toArray();
            res.send(result);
         } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Error fetching user transactions" });
         }
      });


      //   GET: Total Income by User Email
      app.get("/transactions/total-income", async (req, res) => {
         try {
            const userEmail = req.query.userEmail;
            if (!userEmail) return res.status(400).json({ message: "User email is required" });

            const result = await transactionsCollection
               .aggregate([
                  { $match: { userEmail: userEmail, type: "Income" } },
                  { $group: { _id: null, total: { $sum: "$amount" } } },
               ])
               .toArray();

            const total = result.length > 0 ? result[0].total : 0;
            res.json({ total });
         } catch (error) {
            console.error("Error calculating total income:", error);
            res.status(500).json({ message: "Internal server error" });
         }
      });


      // GET: Total Expense by User Email

      app.get("/transactions/total-expense", async (req, res) => {
         try {
            const userEmail = req.query.userEmail;
            if (!userEmail) return res.status(400).json({ message: "User email is required" });

            const result = await transactionsCollection
               .aggregate([
                  { $match: { userEmail: userEmail, type: "Expense" } },
                  { $group: { _id: null, total: { $sum: "$amount" } } },
               ])
               .toArray();

            const total = result.length > 0 ? result[0].total : 0;
            res.json({ total });
         } catch (error) {
            console.error("Error calculating total expense:", error);
            res.status(500).json({ message: "Internal server error" });
         }
      });

      //  /category-total
      app.get("/transactions/category-total", async (req, res) => {
         try {
            const { category, userEmail } = req.query;

            if (!category || !userEmail) {
               return res.status(400).json({ message: "Category and userEmail are required" });
            }

            const result = await transactionsCollection
               .aggregate([

                  { $match: { category: category, userEmail: userEmail } },
                  { $group: { _id: null, total: { $sum: "$amount" } } },
               ])
               .toArray();

            const total = result.length > 0 ? result[0].total : 0;
            res.json({ total });
         } catch (error) {
            console.error("Error calculating category total:", error);
            res.status(500).json({ message: "Internal server error" });
         }
      });

      //  GET: Single transaction by ID --> View 

      app.get("/transactions/:id",  async (req, res) => {
         try {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid transaction ID" });

            const transaction = await transactionsCollection.findOne({ _id: new ObjectId(id) });
            if (!transaction) return res.status(404).send({ message: "Transaction not found" });

            res.send(transaction);
         } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Error fetching transaction" });
         }
      });

      //  GET: Reports for charts (data fetching)
      app.get("/reports", async (req, res) => {
         try {
            const email = req.query.email;
            if (!email) return res.status(400).send({ message: "Email is required" });

            const result = await transactionsCollection.find({ userEmail: email }).sort({ date: -1 }).toArray();
            res.send(result);
         } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Error fetching reports" });
         }
      });

      //  PUT: Update transaction --> update 
      app.put("/transactions/:id", (req, res, next) => {
         console.log('i am from middlware....')
         next()

      }, async (req, res) => {
         try {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid transaction ID" });

            const { type, category, amount, description, date, userEmail } = req.body;

            const transaction = await transactionsCollection.findOne({ _id: new ObjectId(id) });
            if (!transaction) return res.status(404).send({ message: "Transaction not found" });
            if (transaction.userEmail !== userEmail) return res.status(403).send({ message: "Not authorized" });

            const result = await transactionsCollection.updateOne(
               { _id: new ObjectId(id) },
               { $set: { type, category, amount: parseFloat(amount), description, date } }
            );

            res.send(result);
         } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Failed to update transaction" });
         }
      });

      // 9 DELETE: Delete transaction
      app.delete("/transactions/:id", async (req, res) => {
         try {
            const id = req.params.id;
            const { userEmail } = req.query;
            if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid transaction ID" });
            if (!userEmail) return res.status(400).send({ message: "User email required" });

            const transaction = await transactionsCollection.findOne({ _id: new ObjectId(id) });
            if (!transaction) return res.status(404).send({ message: "Transaction not found" });
            if (transaction.userEmail !== userEmail) return res.status(403).send({ message: "Not authorized" });

            const result = await transactionsCollection.deleteOne({ _id: new ObjectId(id) });
            res.send(result);
         } catch (error) {
            console.error(error);
            res.status(500).send({ message: "Failed to delete transaction" });
         }
      });

      console.log(" Backend routes ready!");
   } catch (err) {
      console.error(" MongoDB connection failed:", err);
   }
}

run().catch(console.dir);

app.listen(port, () => console.log(` Server running at http://localhost:${port}`));