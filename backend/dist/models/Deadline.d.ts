import mongoose, { Document, Types } from "mongoose";
export declare const DEADLINE_TYPES: readonly ["OA due date", "Follow-up reminder", "Interview prep", "Offer decision", "Thank you note", "Other"];
export type DeadlineType = (typeof DEADLINE_TYPES)[number];
export interface IDeadline extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    applicationId: Types.ObjectId | null;
    type: string;
    dueDate: Date;
    completed: boolean;
    notes: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Deadline: mongoose.Model<IDeadline, {}, {}, {}, mongoose.Document<unknown, {}, IDeadline, {}, {}> & IDeadline & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
