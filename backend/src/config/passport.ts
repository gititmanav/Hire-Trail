/**
 * Passport serialization + Local (email/password) + optional Google OAuth 2.0.
 * Google flow links existing email accounts by attaching `googleId`.
 */
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User, IUser } from "../models/User.js";
import { env } from "./env.js";
import { isAdminEmail } from "../utils/admin.js";
import {
  getMaintenanceMode,
  isMaintenanceBypassEmail,
  MAINTENANCE_AUTH_MESSAGE,
} from "../services/maintenance.js";

export function configurePassport(): void {
  passport.serializeUser((user, done) => {
    done(null, (user as IUser)._id.toString());
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });

  // Local strategy
  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await User.findOne({ email: email.toLowerCase() });

          if (!user) {
            return done(null, false, { message: "No account with that email" });
          }

          if (!user.password) {
            return done(null, false, {
              message: "This account uses Google sign-in",
            });
          }

          const isMatch = await user.comparePassword(password);
          if (!isMatch) {
            return done(null, false, { message: "Incorrect password" });
          }

          if ((await getMaintenanceMode()) && !isMaintenanceBypassEmail(user.email)) {
            return done(null, false, { message: MAINTENANCE_AUTH_MESSAGE });
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  // Google OAuth strategy
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const maintenance = await getMaintenanceMode();

            // Check if Google account already linked
            const existingUser = await User.findOne({ googleId: profile.id });
            if (existingUser) {
              if (maintenance && !isMaintenanceBypassEmail(existingUser.email)) {
                return done(null, false, { message: MAINTENANCE_AUTH_MESSAGE });
              }
              return done(null, existingUser);
            }

            // Check if email exists from local signup
            const emailUser = await User.findOne({
              email: profile.emails?.[0]?.value,
            });

            if (emailUser) {
              if (maintenance && !isMaintenanceBypassEmail(emailUser.email)) {
                return done(null, false, { message: MAINTENANCE_AUTH_MESSAGE });
              }
              emailUser.googleId = profile.id;
              if (isAdminEmail(emailUser.email)) {
                emailUser.role = "admin";
              }
              await emailUser.save();
              return done(null, emailUser);
            }

            const rawEmail = profile.emails?.[0]?.value;
            if (maintenance && !isMaintenanceBypassEmail(rawEmail)) {
              return done(null, false, { message: MAINTENANCE_AUTH_MESSAGE });
            }

            // Create new user
            const newUser = await User.create({
              name: profile.displayName,
              email: rawEmail,
              googleId: profile.id,
              password: null,
              role: isAdminEmail(rawEmail) ? "admin" : "user",
            });

            return done(null, newUser);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }
}
