const bcrypt = require("bcrypt");
const passport = require("passport");

// middleware that ensures a user is authenticated, otherwise sends them to '/'
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/");
};

module.exports = (app, myDataBase) => {
  app.route("/").get((req, res) => {
    // can also do process.pwd() + "/views/pug/index"
    res.render("pug/index", {
      title: "Connected to Database",
      message: "Please login",
      showLogin: true,
      showRegistration: true,
      showSocialAuth: true,
    });
  });

  app.route("/auth/github").get(passport.authenticate("github"));
  app
    .route("/auth/github/callback")
    .get(
      passport.authenticate("github", { failureRedirect: "/" }),
      (req, res) => {
        req.session.user_id = req.user.id;
        res.redirect("/chat");
      }
    );

  app.route("/chat").get(ensureAuthenticated, (req, res) => {
    res.render("pug/chat", {
      user: req.user,
    });
  });

  app
    .route("/login")
    .post(
      passport.authenticate("local", { failureRedirect: "/" }),
      (req, res) => {
        res.redirect("/chat");
      }
    );

  app.route("/logout").get((req, res) => {
    req.logout();
    res.redirect("/");
  });

  app.route("/profile").get(ensureAuthenticated, (req, res) => {
    res.render("pug/profile", {
      name: req.user.name,
    });
  });

  app.route("/register").post(
    (req, res, next) => {
      myDataBase.findOne({ name: req.body.name }, (err, user) => {
        if (err) {
          next(err);
        } else if (user) {
          res.redirect("/");
        } else {
          const hash = bcrypt.hashSync(req.body.password, 12);
          myDataBase.insertOne(
            { name: req.body.name, password: hash },
            (err, doc) => {
              if (err) {
                res.redirect("/");
              } else {
                // the inserted document is held within the ops property of the doc
                next(null, doc.ops[0]);
              }
            }
          );
        }
      });
    },
    passport.authenticate("local", { faliureRedirect: "/" }),
    (req, res, next) => {
      res.redirect("/profile");
    }
  );

  app.use((req, res, next) => {
    res.status(404).type("text").send("Not Found");
  });
};
