import mongoose, { Schema } from "mongoose";
export const CONNECTION_SOURCES = [
    "Cold email",
    "Referral",
    "Career fair",
    "LinkedIn",
    "Professor intro",
    "Alumni network",
    "Other",
];
const contactSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, "Contact name is required"],
        trim: true,
        maxlength: 100,
    },
    company: {
        type: String,
        required: [true, "Company is required"],
        trim: true,
        maxlength: 200,
    },
    role: {
        type: String,
        default: "",
        trim: true,
        maxlength: 100,
    },
    linkedinUrl: {
        type: String,
        default: "",
        trim: true,
    },
    connectionSource: {
        type: String,
        default: "",
        trim: true,
    },
    lastContactDate: {
        type: Date,
        default: Date.now,
    },
    notes: {
        type: String,
        default: "",
        maxlength: 5000,
    },
}, { timestamps: true });
contactSchema.index({ userId: 1, company: 1 });
export const Contact = mongoose.model("Contact", contactSchema);
//# sourceMappingURL=Contact.js.map