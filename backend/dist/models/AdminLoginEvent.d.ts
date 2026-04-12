import mongoose, { Document } from "mongoose";
export interface IAdminLoginEvent extends Document {
    userId: mongoose.Types.ObjectId;
    email: string;
    name: string;
    provider: "local" | "google";
    ipAddress: string;
    userAgent: string;
    loggedInAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const AdminLoginEvent: mongoose.Model<IAdminLoginEvent, {}, {}, {}, mongoose.Document<unknown, {}, IAdminLoginEvent, {}, {}> & IAdminLoginEvent & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
