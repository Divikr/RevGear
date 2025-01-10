const express = require("express")
const app = express()
const path = require("path")
const userRoute = require("./router/userRoute")
const adminRoute = require("./router/adminRoute")
const env = require("dotenv").config
const db = require("./config/db")
const passport = require("./config/passport");
const bodyParser = require('body-parser');
const session = require('express-session')
const nocache = require("nocache")
const Razorpay = require('razorpay');
db()

app.use(express.static(path.join(__dirname, "public")))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}))




app.use(nocache());


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.use(passport.initialize());
app.use(passport.session());

app.set("view engine", "ejs")
app.set("views", [path.join(__dirname, "views/user"), path.join(__dirname, "views/admin")])

app.use("/", userRoute)
app.use("/admin", adminRoute)

const searchRoutes = require('./router/searchRoute');
app.use(searchRoutes);

app.listen(4000, () => {
    console.log("server running");
})

module.exports = app


