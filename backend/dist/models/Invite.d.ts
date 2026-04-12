import mongoose, { Document } from "mongoose";
export interface IInviteUsage {
    userId: mongoose.Types.ObjectId;
    usedAt: Date;
}
export interface IInvite extends Document {
    code: string;
    email: string | null;
    maxUses: number;
    usedCount: number;
    expiresAt: Date;
    createdBy: mongoose.Types.ObjectId;
    usedBy: IInviteUsage[];
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Invite: mongoose.Model<IInvite, {}, {}, {}, mongoose.Document<unknown, {}, IInvite, {}, {}> & IInvite & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
