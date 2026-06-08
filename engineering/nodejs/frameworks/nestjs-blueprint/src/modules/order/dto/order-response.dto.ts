export class OrderResponseDto {
  id: string;
  productId: string;
  quantity: number;
  note?: string;
  createdAt: Date;
}
