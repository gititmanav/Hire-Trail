/**
 * Passport serialization + Local (email/password) + optional Google OAuth 2.0.
 * Google flow links existing email accounts by attaching `googleId`.
 */
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../models/User.js";
import { env } from "./env.js";
import { isAdminEmail } from "../utils/admin.js";
export function configurePassport() {
    passport.serializeUser((user, done) => {
        done(null, user._id.toString());
    });
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        }
        catch (err) {
            done(err, null);
        }
    });
    // Local strategy
    passport.use(new LocalStrategy({ usernameField: "email", passwordField: "password" }, async (email, password, done) => {
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
            return done(null, user);
        }
        catch (err) {
            return done(err);
        }
    }));
    // Google OAuth strategy
    if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL) {
        passport.use(new GoogleStrategy({
            clientID: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            callbackURL: env.GOOGLE_CALLBACK_URL,
        }, async (_accessToken, _refreshToken, profile, done) => {
            try {
                // Check if Google account already linked
                const existingUser = await User.findOne({ googleId: profile.id });
                if (existingUser)
                    return done(null, existingUser);
                // Check if email exists from local signup
                const emailUser = await User.findOne({
                    email: profile.emails?.[0]?.value,
                });
                if (emailUser) {
                    emailUser.googleId = profile.id;
                    if (isAdminEmail(emailUser.email)) {
                        emailUser.role = "admin";
                    }
                    await emailUser.save();
                    return done(null, emailUser);
                }
                // Create new user
                const newUser = await User.create({
                    name: profile.displayName,
                    email: profile.emails?.[0]?.value,
                    googleId: profile.id,
                    password: null,
                    role: isAdminEmail(profile.emails?.[0]?.value) ? "admin" : "user",
                });
                return done(null, newUser);
            }
            catch (err) {
                return done(err);
            }
        }));
    }
}
//# sourceMappingURL=passport.js.map