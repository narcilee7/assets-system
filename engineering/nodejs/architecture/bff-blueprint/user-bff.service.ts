import { Errors } from '../../api-design/error-model/app-error';

interface UserProfile {
  id: string;
  name: string;
  orders: any[];
  loyalty: any;
}

interface UserServiceClient {
  getUser(id: string): Promise<{ id: string; name: string }>;
}

interface OrderServiceClient {
  getRecentOrders(userId: string): Promise<any[]>;
}

interface LoyaltyServiceClient {
  getPoints(userId: string): Promise<any>;
}

export class UserBffService {
  constructor(
    private userClient: UserServiceClient,
    private orderClient: OrderServiceClient,
    private loyaltyClient: LoyaltyServiceClient,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const [user, orders, loyalty] = await Promise.allSettled([
      this.userClient.getUser(userId),
      this.orderClient.getRecentOrders(userId),
      this.loyaltyClient.getPoints(userId).catch(() => null),
    ]);

    if (user.status === 'rejected') throw Errors.notFound('User');

    return {
      id: user.value.id,
      name: user.value.name,
      orders: orders.status === 'fulfilled' ? orders.value : [],
      loyalty: loyalty.status === 'fulfilled' ? loyalty.value : { points: 0 },
    };
  }
}
