import mongoose, { Document, Types } from "mongoose";
export interface ICompany extends Document {
    _id: Types.ObjectId;
    name: string;
    website: string;
    domain: string;
    createdBy: Types.ObjectId;
    users: Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const Company: mongoose.Model<ICompany, {}, {}, {}, mongoose.Document<unknown, {}, ICompany, {}, {}> & ICompany & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
}, any>;
