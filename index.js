import express from "express";
import bodyParser from "body-parser";
import path from 'path';
import { fileURLToPath } from 'url';
import pg from "pg";
import session from "express-session";
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

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
    res.render("login.ejs", { invalid: false });
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

// Update login to handle "admin" username

app.get("/register", (req, res) => {
    res.render("register.ejs", { error: null });
});

// Handle registration form submission
app.post("/register", async (req, res) => {
    const { cust_name, phone_number, email, password, address, pincode } = req.body;

    try {
        // Check if user already exists
        const userExists = await db.query('SELECT * FROM customer WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.render('register.ejs', { error: 'Email already registered!' });
        }


        // Insert the new customer into the database
        await db.query(
            `INSERT INTO customer (cust_name, phone_number, email, password, address, pincode)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [cust_name, phone_number, email, password, address, pincode]
        );

        // Redirect to login page after successful registration
        res.redirect('/login');
    } catch (err) {
        console.error('Error during registration:', err.message);
        res.render('register.ejs', { error: 'Registration failed. Please try again.' });
    }
});
app.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        if (username === 'admin') {
            // Hardcoded admin password check (you can change this for security)
            if (password === process.env.ADMIN_PASSWORD) {
                req.session.isLoggedIn = true;
                req.session.userRole = 'admin';
                res.redirect("/admin");
            } else {
                res.render("login.ejs", { invalid: true });
            }
        } else {
            // Normal customer login
            const result = await db.query(
                `SELECT * FROM customer WHERE email = $1`,
                [username+""]
            );

            if (result.rows.length > 0) {
                const user = result.rows[0];
                console.log(user);
                // Compare the hashed password
                const match = password == user.password;

                if (match) {
                    req.session.isLoggedIn = true;
                    req.session.userRole = 'customer';
                    req.session.userId = user.id;

                    res.redirect("/home");
                } else {
                    res.render("login.ejs", { invalid: true });
                }
            } else {
                res.render("login.ejs", { invalid: true });
            }
        }
    } catch (err) {
        console.error("Error during login:", err.message);
        res.status(500).send("An error occurred during login. Please try again.");
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
