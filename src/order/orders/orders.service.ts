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
import { VouchersService } from 'src/promotion/vouchers/vouchers.service';
import { Voucher } from 'src/promotion/vouchers/entities/voucher.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private readonly productsService: ProductsService,
    private readonly vouchersService: VouchersService,
  ) {}
  async create(createOrderDto: CreateOrderDto) {
    try {
      // Validate all order items and check availability
      await this.validateOrderItems(createOrderDto.items); // Validate and apply voucher if provided
      let appliedVoucher: Voucher | null = null;
      if (createOrderDto.voucherId) {
        const voucherValidation = await this.vouchersService.validateVoucher(
          createOrderDto.voucherId,
          createOrderDto.subTotal,
        );

        if (!voucherValidation.isValid) {
          throw new BadRequestException(
            `Voucher validation failed: ${voucherValidation.error}`,
          );
        }

        if (!voucherValidation.voucher) {
          throw new BadRequestException('Voucher not found after validation');
        }

        appliedVoucher = voucherValidation.voucher;

        // Verify discount amount matches
        const expectedDiscount = appliedVoucher.calculateDiscount(
          createOrderDto.subTotal,
        );
        const actualDiscount = createOrderDto.discount || 0;
        if (Math.abs(actualDiscount - expectedDiscount) > 0.01) {
          throw new BadRequestException(
            `Discount amount mismatch. Expected: ${expectedDiscount}, Received: ${actualDiscount}`,
          );
        }
      }

      // Generate unique order number
      const orderNumber = this.generateOrderNumber();

      // Destructure to separate items from order data
      const { items, userId, voucherId, ...orderFields } = createOrderDto;

      // Create order with optional user and voucher relations
      const orderData: Partial<Order> = {
        ...orderFields,
        orderNumber,
        status: OrderStatus.PENDING,
      };

      // Only set user relation if userId is provided (authenticated user)
      if (userId) {
        orderData.user = { id: userId } as User;
      } // Set voucher relation if voucher is applied
      if (appliedVoucher) {
        orderData.voucher = appliedVoucher;
      }

      const order = this.orderRepository.create(orderData);

      const savedOrder = await this.orderRepository.save(order);

      // Update stock quantities after successful order creation
      await this.updateStockForOrderItems(items); // If voucher was used, increment its usage count
      if (appliedVoucher && createOrderDto.voucherId) {
        await this.vouchersService.incrementUsage(createOrderDto.voucherId);
      }

      // Simply return the order - payment handling should be done separately via PaymentsController
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
      relations: ['items', 'items.product', 'payment', 'voucher'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }
  async findByOrderNumber(orderNumber: string) {
    const order = await this.orderRepository.findOne({
      where: { orderNumber },
      relations: ['items', 'items.product', 'payment', 'voucher'],
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
   */ async findOneForUser(id: string, userId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, user: { id: userId } },
      relations: ['items', 'items.product', 'payment', 'user', 'voucher'],
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
