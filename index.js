import express from "express";
import bodyParser from "body-parser";
import path from 'path';
import { fileURLToPath } from 'url';
import pg from "pg";
import session from "express-session";
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const db = new Pool({
  connectionString: process.env.POSTGRES_URL || "",
});

// Check if database connection was successful
db.connect().then(() => {
  console.log('Connected to database successfully.');
}).catch(err => {
  console.error('Error connecting to database:', err.message);
});

const app = express();
const port = process.env.PORT || 9999;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'default_secret', // Use a fallback for testing
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
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

    if (username === 'admin' && password === 'password') {
        req.session.isLoggedIn = true;
        req.session.userRole = 'admin';
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
            console.error('Error destroying session:', err.message);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        return res.redirect('/login');
    });
});

app.post("/admin/add-farmer", async (req, res) => {
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
        const result = await db.query(
            `INSERT INTO farmer (name, phone_number, address, farm_location, joining_date, status, bank_details, password, pincode, aadhar_number, photo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [name, phone_number, address, farm_location, joining_date, true, bank_details, password, pincode, aadhar_number, photo]
        );

        console.log('New farmer added with ID:', result.rows[0].id);
        res.redirect("/admin");
    } catch (err) {
        console.error("Error adding new farmer:", err.message);
        res.status(500).send("Failed to add new farmer. Please check the server logs for more details.");
    }
});

function checkAuth(req, res, next) {
    if (req.session.isLoggedIn) {
        next();
    } else {
        res.redirect("/login");
    }
}

app.use(express.static(path.join(__dirname, 'public')));

app.get("/home", checkAuth, (req, res) => {
    res.render("home.ejs");
});

app.get("/admin", checkAuth, async (req, res) => {
    if (req.session.userRole !== 'admin') {
        return res.redirect("/home");
    }

    try {
        console.log("Fetching farmers from database...");
        const result = await db.query("SELECT * FROM farmer");
        const farmers = result.rows;
        res.render("admin.ejs", { farmers });
    } catch (err) {
        console.error("Error fetching farmers:", err.message);
        res.send("An error occurred. Check server logs.");
    }
});

app.get("/search", async (req, res) => {
    const search = req.query.searchItem;
    console.log("Search term:", search);

    try {
        const result = await db.query("SELECT * FROM vegetables WHERE name = $1", [search]);
        const products = result.rows;
        console.log("Products found:", products);

        res.render("buy.ejs", { products });
    } catch (err) {
        console.error("Error occurred during database query:", err.message);
        res.redirect("/home");
    }
});

app.listen(port, () => {
    console.log('Postgres URL:', process.env.POSTGRES_URL);
    console.log("Listening on port " + port);
});
