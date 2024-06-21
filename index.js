const express = require('express');
const cors = require('cors');
// const SSLCommerzPayment = require('sslcommerz-lts')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const app = express();
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 9000;

//middleware
app.use(cors({
    origin: ['http://localhost:5173', 'https://a-11-job-marketplace.web.app', 'https://a-11-job-marketplace.firebaseapp.com'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())

// Our middleware and verify token

const verifyToken = (req, res, next) => {
    console.log('inside verify token', req.headers)
    if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden access' })
    }
    const token = req.headers.authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
    })

}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster1.hauko36.mongodb.net/?retryWrites=true&w=majority&appName=Cluster1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// const store_id = process.env.STORE_ID;
// const store_passwd = process.env.STORE_PASS;
// const is_live = false //true for live, false for sandbox

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();




        // auth related api


        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token });
        })

        // clear cookie 
        app.post('/logout', async (req, res) => {
            res
                .clearCookie('token', {
                    ...cookieOptions, maxAge: 0,
                })
                .send({ success: true })
        })



        //___________PAYMENT RELATED API________________//

        // const tran_id = new ObjectId().toString();

        // app.post('/pay', async (req, res) => {
        //     const jobDetails = req.body;
        //     const data = {
        //         total_amount: 100,
        //         currency: 'BDT',
        //         tran_id: tran_id, // use unique tran_id for each api call
        //         success_url: `https://jobjet-server.vercel.app/payment/success/${tran_id}`,
        //         fail_url: `https://jobjet-server.vercel.app/payment/fail/${tran_id}`,
        //         cancel_url: 'http://localhost:3030/cancel',
        //         ipn_url: 'http://localhost:3030/ipn',
        //         shipping_method: 'Courier',
        //         product_name: 'Computer.',
        //         product_category: 'Electronic',
        //         product_profile: 'general',
        //         cus_name: 'Customer Name',
        //         cus_email: 'customer@example.com',
        //         cus_add1: 'Dhaka',
        //         cus_add2: 'Dhaka',
        //         cus_city: 'Dhaka',
        //         cus_state: 'Dhaka',
        //         cus_postcode: '1000',
        //         cus_country: 'Bangladesh',
        //         cus_phone: '01711111111',
        //         cus_fax: '01711111111',
        //         ship_name: 'Customer Name',
        //         ship_add1: 'Dhaka',
        //         ship_add2: 'Dhaka',
        //         ship_city: 'Dhaka',
        //         ship_state: 'Dhaka',
        //         ship_postcode: 1000,
        //         ship_country: 'Bangladesh',
        //     };
        //     console.log(data)
        //     const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
        //     sslcz.init(data).then(apiResponse => {
        //         // Redirect the user to payment gateway
        //         let GatewayPageURL = apiResponse.GatewayPageURL
        //         res.send({ url: GatewayPageURL });

        //         const finalJobDetails = { ...jobDetails, paidStatus: false, transactionId: tran_id }
        //         console.log(finalJobDetails)
        //         const result = jobCOllection.insertOne(finalJobDetails)

        //         console.log('Redirecting to: ', GatewayPageURL)
        //     });
        //     app.post("/payment/success/:tranId", async (req, res) => {
        //         console.log(req.params.tranId)
        //         const result =await jobCOllection.updateOne({transactionId:req.params.tranId},
        //             {
        //                 $set: {
        //                     paidStatus: true
        //                 }
        //             }
        //         )
        //         if (result.modifiedCount>0){
        //             res.redirect(`https://a-11-job-marketplace.web.app/payment/success/${req.params.tranId}`)
        //         }
        //     })
        //     app.post("/payment/fail/:tranId", async (req, res)=>{
        //         const result = await jobCOllection.deleteOne({transactionId: req.params.tranId })
        //         if(result.deletedCount){
        //             res.redirect(`https://a-11-job-marketplace.web.app/payment/fail/${req.params.tranId}`)
        //         }
        //     })
        // })

        //////////////////////////////////////////////////////////////////////////////////////////

        // /////////////////////Job MArketplace/////////////////////////////////////////////////////////////////////
        const popularCampsCollection = client.db('MedVenture').collection('popularCamps')
        const participantsCollection = client.db('MedVenture').collection('campParticipants')
        const userCollection = client.db('MedVenture').collection('users')
        const paymentCollection = client.db('MedVenture').collection('paymentHistory')

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden Access' })
            }
            next()
        }

        // Admin apis
        app.patch('/confirmationStatus/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    confirmation_status: 'confirmed'
                }
            }
            const result = await participantsCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        //users related api

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.patch('/user/:email', async (req, res) => {
            const email = { email: req.params.email };
            const profileDetails = req.body;
            const updatedDoc = {
                $set: {
                    name: profileDetails.name,
                    address: profileDetails.address,
                    phone: profileDetails.phone,
                    image: profileDetails.image
                }
            }
            const result = await userCollection.updateOne(email, updatedDoc);
            res.send(result)
        })

        app.get('/userProfile/:email', verifyToken, async (req, res) => {
            const query = { email: req.params.email }
            const result = await userCollection.findOne(query)
            res.send(result)
        })

        // Get all camps data
        app.get('/camps', async (req, res) => {
            const result = await popularCampsCollection.find().toArray();
            res.send(result);
        })
        // Add a camp by admin
        app.post('/addCamp', verifyToken, verifyAdmin, async (req, res) => {
            const camp = req.body;
            const result = await popularCampsCollection.insertOne(camp)
            res.send(result)
        })


        // update camp details by admin
        app.patch('/updateCampDetails/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updatedCamp = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    name: updatedCamp.name,
                    fees: updatedCamp.fees,
                    dateTime: updatedCamp.dateTime,
                    location: updatedCamp.location,
                    healthcareProfessional: updatedCamp.healthcareProfessional,
                    description: updatedCamp.description,
                    image: updatedCamp.image
                }
            }
            const result = await popularCampsCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        // Delete a camp by admin
        app.delete('/deleteCamp/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await popularCampsCollection.deleteOne(query)
            res.send(result)
        })

        // Get all participants data by admin
        app.get('/participants', verifyToken, verifyAdmin, async (req, res) => {
            const result = await participantsCollection.find().toArray();
            res.send(result)
        })

        // Specific Camp data
        app.get('/campData/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await popularCampsCollection.findOne(query);
            res.send(result);
        })
        // search Camp
        app.get('/search-camp', async (req, res) => {
            const search = req.query.search;
            let query = {
                $or: [
                    {name: { $regex: search, $options: 'i' }},
                    {location: { $regex: search, $options: 'i' }},
                    {healthcareProfessional: { $regex: search, $options: 'i' }}
                ]
            }
            const result = await popularCampsCollection.find(query).toArray()
            res.send(result)
        })

        // Join camp Participants
        app.post('/joinCamp', verifyToken, async (req, res) => {
            const participant = req.body;
            const result = await participantsCollection.insertOne(participant);
            res.send(result)
        })

        // increase participants count by 1
        app.patch('/participantCount/:id', async (req, res) => {
            const id = req.params.id;
            const result = await popularCampsCollection.updateOne({ _id: new ObjectId(id) }, {
                $inc: { participantCount: 1 } // Increment by 1
            })
            res.send(result)
        })

        // Participant Logged in apis
        app.get('/userRegisteredCamps/:email', verifyToken, async (req, res) => {
            const query = { participant_email: req.params.email }
            const result = await participantsCollection.find(query).toArray()
            res.send(result)
        })

        // Payment----------------------------------------------------------------------------------------
        app.post("/create-payment-intent", async (req, res) => {
            const { paymentFee } = req.body;
            const amount = parseInt(paymentFee * 100);
            console.log('amount inside the intent', amount)

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });

        });

        app.get('/paymentCampData/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await participantsCollection.findOne(query);
            res.send(result);
        })

        app.post('/paymentHistory', async (req, res) => {
            const payment = req.body;
            const result = await paymentCollection.insertOne(payment)
            res.send(result)

        })
        app.patch('/paymentStatus/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    payment_status: payment.payment_status
                }
            }
            const result = await participantsCollection.updateOne(query, updatedDoc)
            res.send(result)
        })

        app.delete('/cancelCamp/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const result = await participantsCollection.deleteOne({ _id: new ObjectId(id) })
            res.send(result)
        })




        //update a job

        app.patch('/update/:id', async (req, res) => {
            const id = req.params.id;
            const jobInfo = req.body;
            console.log(req.body)
            const query = { _id: new ObjectId(id) }
            console.log(jobInfo)
            const updateDoc = {
                $set: jobInfo
            }
            const result = await jobCOllection.updateOne(query, updateDoc)
            res.send(result)
        })

        //update a job count of job applicants
        app.patch('/job-count/:id', async (req, res) => {
            const id = req.params.id;


            const result = await jobCOllection.updateOne({ _id: new ObjectId(id) }, {
                $inc: { job_applicants_number: 1 } // Increment by 1
            })
            // const query = { _id: new ObjectId(id) }

            res.send(result)
        })




        //search job
        app.get('/search-job', async (req, res) => {
            const search = req.query.search;
            let query = { job_title: { $regex: search, $options: 'i' } }
            const result = await jobCOllection.find(query).toArray()
            res.send(result)
        })






        ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////




        // app.post('/logout', async(req, res)=>{
        //   const user = req.body;
        //   console.log('logging out', user)






        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('MedVenture is running')
})
app.listen(port, () => {
    console.log(`MedVenture server is running on port ${port}`)
})