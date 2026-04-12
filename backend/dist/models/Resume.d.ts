import mongoose, { Document } from "mongoose";
export interface IResume extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    targetRole: string;
    fileName: string;
    fileUrl: string;
    filePublicId: string;
    uploadDate: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Resume: mongoose.Model<IResume, {}, {}, {}, mongoose.Document<unknown, {}, IResume, {}, {}> & IResume & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
