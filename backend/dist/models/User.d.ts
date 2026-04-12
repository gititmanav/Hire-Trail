/** User document: local password and/or Google OAuth; password hash stripped in `toJSON`. */
import mongoose, { Document } from "mongoose";
export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    name: string;
    email: string;
    password: string | null;
    googleId: string | null;
    role: "user" | "admin";
    suspended: boolean;
    suspendedAt: Date | null;
    deleted: boolean;
    deletedAt: Date | null;
    tourCompleted: boolean;
    /** Default resume for new applications (e.g. Chrome extension). */
    primaryResumeId: mongoose.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidate: string): Promise<boolean>;
}
export declare const User: mongoose.Model<IUser, {}, {}, {}, mongoose.Document<unknown, {}, IUser, {}, {}> & IUser & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
