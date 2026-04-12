import mongoose, { Schema } from "mongoose";
export const DEADLINE_TYPES = [
    "OA due date",
    "Follow-up reminder",
    "Interview prep",
    "Offer decision",
    "Thank you note",
    "Other",
];
const deadlineSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    applicationId: {
        type: Schema.Types.ObjectId,
        ref: "Application",
        default: null,
    },
    type: {
        type: String,
        required: [true, "Deadline type is required"],
        trim: true,
    },
    dueDate: {
        type: Date,
        required: [true, "Due date is required"],
    },
    completed: {
        type: Boolean,
        default: false,
    },
    notes: {
        type: String,
        default: "",
        maxlength: 2000,
    },
}, { timestamps: true });
deadlineSchema.index({ userId: 1, dueDate: 1 });
deadlineSchema.index({ userId: 1, completed: 1 });
export const Deadline = mongoose.model("Deadline", deadlineSchema);
//# sourceMappingURL=Deadline.js.map