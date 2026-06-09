import { Schema, model } from 'mongoose';

export interface IOrder {
  status: 'pending' | 'paid' | 'cancelled';
  amount: number;
  userId: Schema.Types.ObjectId;
  createdAt: Date;
}

const orderSchema = new Schema<IOrder>(
  {
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
    amount: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

export const Order = model<IOrder>('Order', orderSchema);
