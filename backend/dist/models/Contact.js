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
export const CONTACT_OUTREACH_STATUSES = [
    "not_contacted",
    "reached_out",
    "responded",
    "meeting_scheduled",
    "follow_up_needed",
    "gone_cold",
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
    companyId: {
        type: Schema.Types.ObjectId,
        ref: "Company",
        default: null,
        index: true,
    },
    notes: {
        type: String,
        default: "",
        maxlength: 5000,
    },
    applicationIds: {
        type: [Schema.Types.ObjectId],
        ref: "Application",
        default: [],
    },
    outreachStatus: {
        type: String,
        enum: CONTACT_OUTREACH_STATUSES,
        default: "not_contacted",
    },
    lastOutreachDate: {
        type: Date,
        default: null,
    },
    nextFollowUpDate: {
        type: Date,
        default: null,
    },
}, { timestamps: true });
contactSchema.index({ userId: 1, company: 1 });
export const Contact = mongoose.model("Contact", contactSchema);
//# sourceMappingURL=Contact.js.map