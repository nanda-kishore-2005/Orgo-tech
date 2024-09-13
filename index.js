import express from "express";
import bodyParser from "body-parser";
import path from 'path';
import { fileURLToPath } from 'url';
import pg from "pg";
import session from "express-session";  // Import session module
import dotenv from 'dotenv';


dotenv.config(); // Load environment variables from .env file

// Your existing code


let input= [];


const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.POSTGRES_URL+"",
});

// const db = new pg.Client({
//     user: "postgres",
//     host: "localhost",
//     database: "orgo tech",
//     password: "sai123",
//     port: 5432
// });
db.connect();

const app = express();
const port = 9999;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up session middleware
app.use(session({
    secret: 'yourSecretKey',  // Change this to a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // Set secure to true when using HTTPS
}));

app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.redirect("/login");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});
app.get('/stores', (req, res) => {
    res.render('stores.ejs');
});

app.get('/crops', (req, res) => {
    res.render('crops.ejs');
});

app.get('/achievements', (req, res) => {
    res.render('AandC.ejs');
});




app.post("/login", (req, res) => {
    const { username, password } = req.body;
    
    // Example login logic; replace with your DB login logic
    if (username === 'admin' && password === 'password') {
        req.session.isLoggedIn = true;
        req.session.userRole = 'admin';  // Store the user role
        res.redirect("/admin");
    } else if (username === 'user' && password === 'password') {
        req.session.isLoggedIn = true;
        req.session.userRole = 'user';
        res.redirect("/home");
    } else {
        res.render("login.ejs", { invalid: "true" });
    }
});

app.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        return res.redirect('/login');
    });
});
app.post("/admin/add-farmer", async (req, res) => {
    // Extracting information from the request body
    const {
        name,
        phone_number,
        address,
        farm_location,
        joining_date,
        status,
        bank_details,
        password,
        pincode,
        aadhar_number,
        photo
    } = req.body;

    try {
        // Performing the insert operation into the farmer table
        const result = await db.query(
            `INSERT INTO farmer (name, phone_number, address, farm_location, joining_date, status, bank_details, password, pincode, aadhar_number, photo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [name, phone_number, address, farm_location, joining_date, true, bank_details, password, pincode, aadhar_number, photo]
        );

        console.log('New farmer added with ID:', result.rows[0].id); // Output the ID of the newly added farmer
        res.redirect("/admin"); // Redirect to the admin page or a confirmation page
    } catch (err) {
        console.error("Error adding new farmer:", err);
        res.status(500).send("Failed to add new farmer");
    }
});



// Middleware to protect routes
function checkAuth(req, res, next) {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect("/login");
    }
}

app.use(express.static(path.join(__dirname, 'public')));

// Protect the home and admin routes with session check
app.get("/home", checkAuth, (req, res) => {
    res.render("home.ejs");
});

app.get("/admin", checkAuth, async (req, res) => {
    if (req.session.userRole !== 'admin') {
        return res.redirect("/home");  // Prevent users from accessing the admin page
    }

    try {
        const result = await db.query("SELECT * FROM farmer");
        const farmers = result.rows;
        res.render("admin.ejs", { farmers });
    } catch (err) {
        console.error("Error fetching farmers:", err);
        res.send("An error occurred.");
    }
});

app.get("/search", async (req, res) => {
    const search = req.query.searchItem;
    console.log(search);

    try {
        const result = await db.query("SELECT * FROM vegetables WHERE name = $1", [search]);
        const products = result.rows;
        console.log(products);

        // Render the buy.ejs template with the search results
        res.render("buy.ejs", { products });
    } catch (err) {
        console.log("Error occurred during database query:", err);
        res.redirect("/home");
    }
});


// Add, edit, and delete farmer routes...

app.listen(process.env.PORT, () => {

console.log('Postgres URL:', process.env.POSTGRES_URL);
    console.log("Listening on port " + port);
});
