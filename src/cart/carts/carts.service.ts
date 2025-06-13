import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { Cart } from './entities/cart.entity';
import { CartItem } from '../cart-items/entities/cart-item.entity';
import { User } from 'src/user/users/entities/user.entity';

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createCartDto: CreateCartDto): Promise<Cart> {
    const { userId } = createCartDto;

    // Check if user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already has a cart
    const existingCart = await this.cartRepository.findOne({
      where: { user: { id: userId } },
      relations: ['items', 'items.variant', 'items.variant.product'],
    });

    if (existingCart) {
      return existingCart;
    }

    // Create new cart
    const cart = this.cartRepository.create({
      user,
      items: [],
    });

    return await this.cartRepository.save(cart);
  }

  async findAll(): Promise<Cart[]> {
    return await this.cartRepository.find({
      relations: ['user', 'items', 'items.variant', 'items.variant.product'],
    });
  }

  async findOne(id: string): Promise<Cart> {
    const cart = await this.cartRepository.findOne({
      where: { id },
      relations: [
        'user',
        'items',
        'items.variant',
        'items.variant.product',
        'items.variant.color',
        'items.variant.size',
        'items.variant.images',
      ],
    });

    if (!cart) {
      throw new NotFoundException(`Cart with ID ${id} not found`);
    }

    return cart;
  }

  async findByUserId(userId: string): Promise<Cart> {
    let cart = await this.cartRepository.findOne({
      where: { user: { id: userId } },
      relations: [
        'user',
        'items',
        'items.variant',
        'items.variant.product',
        'items.variant.color',
        'items.variant.size',
        'items.variant.images',
      ],
    });

    if (!cart) {
      // Auto create cart if not exists
      cart = await this.create({ userId });
    }

    return cart;
  }

  async update(id: string, updateCartDto: UpdateCartDto): Promise<Cart> {
    const cart = await this.findOne(id);

    Object.assign(cart, updateCartDto);

    return await this.cartRepository.save(cart);
  }

  async clearCart(id: string): Promise<Cart> {
    const cart = await this.findOne(id);

    cart.items = [];

    return await this.cartRepository.save(cart);
  }

  async clearCartByUserId(userId: string): Promise<Cart> {
    const cart = await this.findByUserId(userId);

    cart.items = [];

    return await this.cartRepository.save(cart);
  }

  // Alias for clearCartByUserId to match controller expectations
  async clearMyCart(userId: string): Promise<Cart> {
    return this.clearCartByUserId(userId);
  }

  // Alias for findByUserId to match controller expectations
  async getMyCart(userId: string): Promise<Cart> {
    return this.findByUserId(userId);
  }

  // Alias for calculateShippingEstimate to match controller expectations
  async getShippingEstimate(
    userId: string,
    addressData: any,
  ): Promise<{
    estimatedCost: number;
    estimatedDeliveryDays: number;
    availableShippingMethods: any[];
  }> {
    return this.calculateShippingEstimate(userId, addressData);
  }

  async remove(id: string): Promise<void> {
    const cart = await this.findOne(id);
    await this.cartRepository.remove(cart);
  }
  async getCartSummary(userId: string): Promise<{
    totalItems: number;
    totalAmount: number;
    isEmpty: boolean;
    items: CartItem[];
  }> {
    const cart = await this.findByUserId(userId);

    return {
      totalItems: cart.getTotalItems(),
      totalAmount: cart.getTotalAmount(),
      isEmpty: cart.isEmpty(),
      items: cart.items || [],
    };
  }

  async mergeGuestCart(
    userId: string,
    guestCartItems: { variantId: string; quantity: number }[],
  ): Promise<Cart> {
    const userCart = await this.findByUserId(userId);

    for (const guestItem of guestCartItems) {
      try {
        // Find existing item in user cart
        const existingItem = userCart.items.find(
          (item) => item.variant.id === guestItem.variantId,
        );

        if (existingItem) {
          // Merge quantities
          existingItem.quantity += guestItem.quantity;
        } else {
          // Add new item to cart (this would need to be handled by CartItemsService)
          // For now, we'll just log it
          console.log(`Need to add new item ${guestItem.variantId} to cart`);
        }
      } catch (error) {
        console.error(`Failed to merge guest cart item:`, error);
      }
    }

    return await this.cartRepository.save(userCart);
  }
  getCartRecommendations(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userId: string,
  ): Promise<{
    frequentlyBoughtTogether: any[];
    similarProducts: any[];
    recentlyViewed: any[];
  }> {
    // This is a placeholder for recommendation logic
    // In a real implementation, you would analyze user behavior, purchase history, etc.

    return Promise.resolve({
      frequentlyBoughtTogether: [],
      similarProducts: [],
      recentlyViewed: [],
    });
  }
  async calculateShippingEstimate(
    userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    shippingAddress?: any,
  ): Promise<{
    estimatedCost: number;
    estimatedDeliveryDays: number;
    availableShippingMethods: any[];
  }> {
    const cart = await this.findByUserId(userId);

    // Placeholder shipping calculation
    // In a real implementation, you would integrate with shipping providers

    const totalWeight = cart.items.reduce((weight, item) => {
      // Assume each item has a weight property
      return weight + item.quantity * 0.5; // 0.5kg per item as example
    }, 0);

    const baseCost = totalWeight * 2; // $2 per kg as example

    return {
      estimatedCost: baseCost,
      estimatedDeliveryDays: 3,
      availableShippingMethods: [
        { name: 'Standard', cost: baseCost, days: 5 },
        { name: 'Express', cost: baseCost * 1.5, days: 2 },
        { name: 'Overnight', cost: baseCost * 3, days: 1 },
      ],
    };
  }
}
