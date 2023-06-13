const express = require('express');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ci4nuyk.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.TOKEN_ACCESS, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const usersCollection = client.db("musicDb").collection("users");
        const classesCollection = client.db("musicDb").collection("classes");
        const userClassCollection = client.db("musicDb").collection('userClasses');

        app.get('/instructors', async (req, res) => {
            const filter = { role: "instructor" }
            const result = await usersCollection.find(filter).toArray();
            res.send(result)
        })

        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().sort({ students: -1 }).toArray();
            res.send(result)
        })

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.TOKEN_ACCESS, { expiresIn: '30d' })

            res.send({ token })
        })

        app.post('/userclasses', verifyJWT, async (req, res) => {
            const classes = req.body;
            const result = await userClassCollection.insertOne(classes);
            res.send(result);
        })

        app.get('/userclasses/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email, payment: 'false' }
            const result = await userClassCollection.find(query).toArray()
            res.send(result);
        })

        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.patch('/payment/:id', async (req, res) => {
            const id = req.params.id;
            const { payment, transactionId, date } = req.body;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: { payment: payment, transactionId: transactionId, date: date }
            }
            const result = await userClassCollection.updateOne(query, updateDoc);
            res.send(result);
        })

        app.get(`/payment/:email`, async (req, res) => {
            const email = req.params.email;
            const query = { email: email, payment: 'true' };
            const result = await userClassCollection.find(query).toArray();
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('music is playing')
})

app.listen(port, () => {
    console.log(`Music is playing on port ${port}`);
})