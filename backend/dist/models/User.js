/** User document: local password and/or Google OAuth; password hash stripped in `toJSON`. */
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
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
    },
    suspended: { type: Boolean, default: false },
    suspendedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    tourCompleted: { type: Boolean, default: false },
    primaryResumeId: {
        type: Schema.Types.ObjectId,
        ref: "Resume",
        default: null,
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
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 }, { sparse: true });
/* Auto-exclude soft-deleted users from normal find queries.
   Admin routes that need deleted users should use User.find({ deleted: true }) explicitly
   or Model.find().setOptions({ includeDeleted: true }). */
userSchema.pre(/^find/, function (next) {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deleted: { $ne: true } });
    }
    next();
});
userSchema.pre("countDocuments", function (next) {
    const opts = this.getOptions();
    if (!opts.includeDeleted) {
        this.where({ deleted: { $ne: true } });
    }
    next();
});
userSchema.pre("save", async function (next) {
    if (!this.isModified("password") || !this.password)
        return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});
userSchema.methods.comparePassword = async function (candidate) {
    if (!this.password)
        return false;
    return bcrypt.compare(candidate, this.password);
};
export const User = mongoose.model("User", userSchema);
//# sourceMappingURL=User.js.map