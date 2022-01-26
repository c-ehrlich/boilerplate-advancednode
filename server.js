"use strict";
require("dotenv").config();
const express = require("express");
const myDB = require("./connection");
const session = require("express-session");
const passport = require("passport");
const fccTesting = require("./freeCodeCamp/fcctesting.js");
const Db = require("mongodb/lib/db");
const passportSocketIo = require("passport.socketio");
const cookieParser = require("cookie-parser");

const routes = require("./routes.js");
const auth = require("./auth.js");

const app = express();

const http = require("http").createServer(app);
const io = require("socket.io")(http);

// initialize memory store for websocket auth
const MongoStore = require("connect-mongo")(session);
const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });

fccTesting(app); //For FCC testing purposes
app.use("/public", express.static(process.cwd() + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "pug");
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    key: "express.sid", // cookie name
    resave: true,
    store: store,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

app.use(passport.initialize());
app.use(passport.session());

io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: "express.sid", // cookie name
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail,
  })
);

const onAuthorizeSuccess = (data, accept) => {
  console.log("successful connection to socket.io");
  accept(null, true);
}

const onAuthorizeFail = (data, message, error, accept) => {
  if (error) throw new Error(message);
  console.log("Failed connection to socket.io:", message);
  accept(null, false);
}

myDB(async (client) => {
  const myDataBase = await client.db("database").collection("users");

  routes(app, myDataBase);
  auth(app, myDataBase);

  let currentUsers = 0;
  // takes 1. string containing the title of the emitted event 2. function with which the data is passed through
  // a socket is an individual client who is connected
  io.on("connection", (socket) => {
    ++currentUsers;
    io.emit("user count", currentUsers);
    console.log("user " + socket.request.user.name + " connected");

    socket.on("disconnect", () => {
      console.log("A user has disconnected");
      --currentUsers;
      io.emit("user count", currentUsers);
    });
  });
}).catch((e) => {
  app.route("/").get((req, res) => {
    res.render("pug", {
      title: e,
      message: "Unable to login",
    });
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log("Listening on port " + PORT);
});
