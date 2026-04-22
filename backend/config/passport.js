import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcrypt";
import { ObjectId } from "mongodb";
import { getDB } from "./db.js";

function configurePassport() {
  // Serialize user ID into session
  passport.serializeUser((user, done) => {
    done(null, user._id.toString());
  });

  // Deserialize user from session by ID
  passport.deserializeUser(async (id, done) => {
    try {
      const db = getDB();
      const user = await db
        .collection("users")
        .findOne({ _id: new ObjectId(id) });
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  // Local strategy — email + password
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const db = getDB();
          const user = await db
            .collection("users")
            .findOne({ email: email.toLowerCase() });

          if (!user) {
            return done(null, false, { message: "No account with that email" });
          }

          if (!user.password) {
            return done(null, false, {
              message: "This account uses Google sign-in",
            });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: "Incorrect password" });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // Google OAuth strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const db = getDB();
            const existingUser = await db
              .collection("users")
              .findOne({ googleId: profile.id });

            if (existingUser) {
              return done(null, existingUser);
            }

            // Check if email already exists from local signup
            const emailUser = await db
              .collection("users")
              .findOne({ email: profile.emails[0].value });

            if (emailUser) {
              // Link Google account to existing local account
              await db
                .collection("users")
                .updateOne(
                  { _id: emailUser._id },
                  { $set: { googleId: profile.id } },
                );
              const updated = await db
                .collection("users")
                .findOne({ _id: emailUser._id });
              return done(null, updated);
            }

            // Create new user from Google profile
            const newUser = {
              name: profile.displayName,
              email: profile.emails[0].value,
              googleId: profile.id,
              password: null,
              createdAt: new Date(),
            };

            const result = await db.collection("users").insertOne(newUser);
            newUser._id = result.insertedId;
            return done(null, newUser);
          } catch (err) {
            return done(err);
          }
        },
      ),
    );
  }
}

export default configurePassport;
