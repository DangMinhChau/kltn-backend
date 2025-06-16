import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto, CreateOrderItemDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order } from './entities/order.entity';
import { OrderStatus } from 'src/common/constants/order-status.enum';
import { PaymentStatus } from 'src/common/constants/payment-status.enum';
import { ProductsService } from 'src/product/products/products.service';
import { User } from 'src/user/users/entities/user.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private readonly productsService: ProductsService,
  ) {}
  async create(createOrderDto: CreateOrderDto) {
    try {
      // Validate all order items and check availability
      await this.validateOrderItems(createOrderDto.items);

      // Generate unique order number
      const orderNumber = this.generateOrderNumber(); // Create order with user relation
      const order = this.orderRepository.create({
        ...createOrderDto,
        orderNumber,
        status: OrderStatus.PENDING,
        user: { id: createOrderDto.userId } as User, // TypeORM will handle the relation
      });

      const savedOrder = await this.orderRepository.save(order);

      // Update stock quantities after successful order creation
      await this.updateStockForOrderItems(createOrderDto.items); // Simply return the order - payment handling should be done separately via PaymentsController
      return savedOrder;
    } catch (error) {
      throw new BadRequestException(
        'Failed to create order: ' +
          (error instanceof Error ? error.message : 'Unknown error'),
      );
    }
  } /**
   * Validate all order items for availability and correct pricing
   */
  private async validateOrderItems(items: CreateOrderItemDto[]): Promise<void> {
    for (const item of items) {
      // Get product info from variant ID
      const productData = await this.productsService.getProductFromVariant(
        item.variantId,
      ); // Check availability
      const availability = await this.productsService.checkProductAvailability(
        productData.product.id,
        item.variantId,
        item.quantity,
      );

      if (!availability.available) {
        throw new BadRequestException(
          `Product "${productData.product.name}" is not available. ${availability.message}`,
        );
      }

      // Validate price (optional - ensures frontend hasn't been tampered with)
      if (Math.abs(item.unitPrice - productData.finalPrice) > 0.01) {
        throw new BadRequestException(
          `Price mismatch for product "${productData.product.name}". Expected: ${productData.finalPrice}, Received: ${item.unitPrice}`,
        );
      }
    }
  }

  /**
   * Update stock quantities for all order items
   */
  private async updateStockForOrderItems(
    items: CreateOrderItemDto[],
  ): Promise<void> {
    for (const item of items) {
      // Get product info from variant
      const productData = await this.productsService.getProductFromVariant(
        item.variantId,
      );

      await this.productsService.updateProductStock(
        productData.product.id,
        item.variantId,
        item.quantity,
      );
    }
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
    userId?: string,
  ): Promise<{
    data: Order[];
    meta: { total: number; page: number; limit: number };
  }> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.payment', 'payment')
      .leftJoinAndSelect('order.user', 'user')
      .orderBy('order.createdAt', 'DESC');

    if (userId) {
      query.where('user.id = :userId', { userId });
    }

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    const [orders, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOne(id: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'payment'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string) {
    const order = await this.orderRepository.findOne({
      where: { orderNumber },
      relations: ['items', 'items.product', 'payment'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto) {
    const order = await this.findOne(id);

    Object.assign(order, updateOrderDto);

    return await this.orderRepository.save(order);
  }
  async updateStatus(id: string, status: OrderStatus, notes?: string) {
    const order = await this.findOne(id);

    order.status = status;
    if (notes) {
      order.note = notes;
    }

    return await this.orderRepository.save(order);
  }
  /**
   * Update payment status of an order (internal method for payment processing)
   * @param id Order ID
   * @param isPaid Payment status
   * @param paidAt Payment date (optional, defaults to current date if isPaid is true)
   * @returns Updated order
   */
  async updatePaymentStatus(
    id: string,
    isPaid: boolean,
    paidAt?: Date,
  ): Promise<Order> {
    const order = await this.findOne(id);

    order.isPaid = isPaid;
    if (isPaid && !paidAt) {
      order.paidAt = new Date();
    } else if (paidAt) {
      order.paidAt = paidAt;
    } else if (!isPaid) {
      (order.paidAt as any) = null; // Reset payment timestamp when payment is cancelled
    }

    return await this.orderRepository.save(order);
  }

  /**
   * Update completion timestamp for an order
   * @param id Order ID
   * @returns Updated order
   */
  async updateCompletionTimestamp(id: string): Promise<Order> {
    const order = await this.findOne(id);
    order.completedAt = new Date();
    return await this.orderRepository.save(order);
  }

  /**
   * Update cancellation timestamp for an order
   * @param id Order ID
   * @returns Updated order
   */
  async updateCancellationTimestamp(id: string): Promise<Order> {
    const order = await this.findOne(id);
    order.canceledAt = new Date();
    return await this.orderRepository.save(order);
  }

  async cancelOrder(id: string, reason?: string) {
    const order = await this.findOne(id);

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot cancel this order');
    }

    order.status = OrderStatus.CANCELLED;
    if (reason) {
      order.note = reason;
    }

    // Handle refund if payment was made
    if (order.payment?.status === PaymentStatus.PAID) {
      // Note: This would require a refund method in PaymentsService
      // For now, we'll just log it as this method doesn't exist
      console.log(`Refund needed for payment ${order.payment.id}`);
    }

    return await this.orderRepository.save(order);
  }
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD${timestamp.slice(-8)}${random}`;
  }

  async remove(id: string) {
    const order = await this.findOne(id);
    return await this.orderRepository.remove(order);
  }
  async getOrderDetails(id: string) {
    return await this.findOne(id);
  }
  /**
   * Find orders for a specific user with pagination
   */
  async findUserOrders(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: OrderStatus,
  ): Promise<{
    data: Order[];
    meta: { total: number; page: number; limit: number };
  }> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .leftJoinAndSelect('order.payment', 'payment')
      .leftJoinAndSelect('order.user', 'user')
      .where('user.id = :userId', { userId })
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    const [orders, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  /**
   * Find a single order and verify user ownership
   */
  async findOneForUser(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['items', 'items.product', 'payment', 'user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Cancel order with user verification
   */
  async cancelOrderForUser(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.findOneForUser(id, userId);

    if (
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot cancel this order');
    }

    order.status = OrderStatus.CANCELLED;
    order.canceledAt = new Date();
    if (reason) {
      order.note = reason;
    }

    // Handle refund if payment was made
    if (order.payment?.status === PaymentStatus.PAID) {
      // Note: This would require a refund method in PaymentsService
      // For now, we'll just log it as this method doesn't exist
      console.log(`Refund needed for payment ${order.payment.id}`);
    }

    return await this.orderRepository.save(order);
  }
}
