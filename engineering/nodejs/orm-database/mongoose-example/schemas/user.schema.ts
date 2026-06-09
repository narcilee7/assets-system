import { Schema, model, Types } from 'mongoose';

export interface IUser {
  email: string;
  name: string;
  balance: number;
  orders: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    balance: { type: Number, default: 0 },
    orders: [{ type: Schema.Types.ObjectId, ref: 'Order' }],
  },
  { timestamps: true }
);

userSchema.index({ email: 1, createdAt: -1 });

export const User = model<IUser>('User', userSchema);
