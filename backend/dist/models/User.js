import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
const userSchema = new Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        default: null,
        minlength: [6, "Password must be at least 6 characters"],
    },
    googleId: {
        type: String,
        default: null,
        sparse: true,
    },
}, {
    timestamps: true,
    toJSON: {
        transform(_doc, ret) {
            const out = ret;
            delete out.password;
            delete out.__v;
            return out;
        },
    },
});
// Index for lookups
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password") || !this.password)
        return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});
// Compare password method
userSchema.methods.comparePassword = async function (candidate) {
    if (!this.password)
        return false;
    return bcrypt.compare(candidate, this.password);
};
export const User = mongoose.model("User", userSchema);
//# sourceMappingURL=User.js.map