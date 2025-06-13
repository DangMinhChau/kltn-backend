import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from '../carts/entities/cart.entity';
import { ProductVariant } from 'src/product/variants/entities/variant.entity';
import { User } from 'src/user/users/entities/user.entity';
import { CreateCartItemDto } from './dto/create-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ProductsService } from 'src/product/products/products.service';

@Injectable()
export class CartItemsService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    private readonly productsService: ProductsService,
  ) {}
  async create(createCartItemDto: CreateCartItemDto): Promise<CartItem> {
    const { cartId, variantId, quantity } = createCartItemDto;

    // Validate cart exists
    const cart = await this.cartRepository.findOne({
      where: { id: cartId },
      relations: ['items'],
    });
    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    // Use productsService to validate variant and check availability
    const productData =
      await this.productsService.getProductFromVariant(variantId);

    const availability = await this.productsService.checkProductAvailability(
      productData.product.id,
      variantId,
      quantity,
    );

    if (!availability.available) {
      throw new BadRequestException(
        `Product "${productData.product.name}" is not available. ${availability.message}`,
      );
    }

    // Check if item already exists in cart
    const existingItem = await this.cartItemRepository.findOne({
      where: { cart: { id: cartId }, variant: { id: variantId } },
    });

    if (existingItem) {
      // Update quantity if item already exists
      const newQuantity = existingItem.quantity + quantity;

      // Check availability for new total quantity
      const newAvailability =
        await this.productsService.checkProductAvailability(
          productData.product.id,
          variantId,
          newQuantity,
        );

      if (!newAvailability.available) {
        throw new BadRequestException(
          `Cannot add ${quantity} more items. ${newAvailability.message}`,
        );
      }

      existingItem.quantity = newQuantity;
      return await this.cartItemRepository.save(existingItem);
    }

    // Create new cart item
    const cartItem = this.cartItemRepository.create({
      cart,
      variant: productData.variant,
      quantity,
    });

    return await this.cartItemRepository.save(cartItem);
  }

  async addToCart(
    userId: string,
    variantId: string,
    quantity: number,
  ): Promise<CartItem> {
    // Find or create user's cart
    let cart = await this.cartRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!cart) {
      cart = await this.cartRepository.save(
        this.cartRepository.create({
          user: { id: userId } as Pick<User, 'id'>,
          items: [],
        }),
      );
    }

    return this.create({
      cartId: cart.id,
      variantId,
      quantity,
    });
  }

  async findAll(): Promise<CartItem[]> {
    return await this.cartItemRepository.find({
      relations: [
        'cart',
        'variant',
        'variant.product',
        'variant.color',
        'variant.size',
      ],
    });
  }

  async findOne(id: string): Promise<CartItem> {
    const cartItem = await this.cartItemRepository.findOne({
      where: { id },
      relations: [
        'cart',
        'variant',
        'variant.product',
        'variant.color',
        'variant.size',
      ],
    });

    if (!cartItem) {
      throw new NotFoundException(`Cart item with ID ${id} not found`);
    }

    return cartItem;
  }

  async findByCartId(cartId: string): Promise<CartItem[]> {
    return await this.cartItemRepository.find({
      where: { cart: { id: cartId } },
      relations: [
        'variant',
        'variant.product',
        'variant.color',
        'variant.size',
        'variant.images',
      ],
    });
  }

  async findByUserId(userId: string): Promise<CartItem[]> {
    return await this.cartItemRepository.find({
      where: { cart: { user: { id: userId } } },
      relations: [
        'variant',
        'variant.product',
        'variant.color',
        'variant.size',
        'variant.images',
      ],
    });
  }

  async update(
    id: string,
    updateCartItemDto: UpdateCartItemDto,
  ): Promise<CartItem> {
    const cartItem = await this.findOne(id);
    const { quantity } = updateCartItemDto;

    if (quantity !== undefined) {
      // Use productsService to check stock availability
      const productData = await this.productsService.getProductFromVariant(
        cartItem.variant.id,
      );

      const availability = await this.productsService.checkProductAvailability(
        productData.product.id,
        cartItem.variant.id,
        quantity,
      );

      if (!availability.available) {
        throw new BadRequestException(
          `Cannot update quantity. ${availability.message}`,
        );
      }

      cartItem.quantity = quantity;
    }

    return await this.cartItemRepository.save(cartItem);
  }
  async updateQuantity(id: string, quantity: number): Promise<CartItem> {
    const cartItem = await this.findOne(id);

    if (quantity <= 0) {
      await this.cartItemRepository.remove(cartItem);
      return cartItem;
    }

    // Use productsService to check stock availability
    const productData = await this.productsService.getProductFromVariant(
      cartItem.variant.id,
    );

    const availability = await this.productsService.checkProductAvailability(
      productData.product.id,
      cartItem.variant.id,
      quantity,
    );

    if (!availability.available) {
      throw new BadRequestException(
        `Cannot update quantity. ${availability.message}`,
      );
    }

    cartItem.quantity = quantity;
    return await this.cartItemRepository.save(cartItem);
  }

  async remove(id: string): Promise<void> {
    const cartItem = await this.findOne(id);
    await this.cartItemRepository.remove(cartItem);
  }

  async removeFromCart(userId: string, variantId: string): Promise<void> {
    const cartItem = await this.cartItemRepository.findOne({
      where: {
        cart: { user: { id: userId } },
        variant: { id: variantId },
      },
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemRepository.remove(cartItem);
  }

  async clearCartItems(cartId: string): Promise<void> {
    await this.cartItemRepository.delete({ cart: { id: cartId } });
  }

  async clearMyCartItems(userId: string): Promise<void> {
    await this.cartItemRepository.delete({
      cart: { user: { id: userId } },
    });
  }

  async bulkAddToCart(
    userId: string,
    items: { variantId: string; quantity: number }[],
  ): Promise<CartItem[]> {
    const results: CartItem[] = [];

    for (const item of items) {
      try {
        const cartItem = await this.addToCart(
          userId,
          item.variantId,
          item.quantity,
        );
        results.push(cartItem);
      } catch (error) {
        // Continue with other items even if one fails
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `Failed to add variant ${item.variantId} to cart:`,
          errorMessage,
        );
      }
    }

    return results;
  }
  async validateCartItems(userId: string): Promise<{
    valid: boolean;
    issues: {
      itemId: string;
      issue: string;
      variant?: any;
    }[];
    summary: {
      totalValidItems: number;
      totalInvalidItems: number;
    };
  }> {
    const cart = await this.cartRepository.findOne({
      where: { user: { id: userId } },
      relations: ['items', 'items.variant', 'items.variant.product'],
    });

    if (!cart) {
      return {
        valid: true,
        issues: [],
        summary: { totalValidItems: 0, totalInvalidItems: 0 },
      };
    }

    const issues: {
      itemId: string;
      issue: string;
      variant?: any;
    }[] = [];
    let validItems = 0;

    for (const item of cart.items) {
      try {
        // Use productsService for comprehensive validation
        const productData = await this.productsService.getProductFromVariant(
          item.variant.id,
        );

        // Check product availability and stock
        const availability =
          await this.productsService.checkProductAvailability(
            productData.product.id,
            item.variant.id,
            item.quantity,
          );

        if (!availability.available) {
          issues.push({
            itemId: item.id,
            issue: availability.message || 'Product not available',
            variant: item.variant,
          });
          continue;
        }

        validItems++;
      } catch (error) {
        // Handle cases where variant or product no longer exists
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        issues.push({
          itemId: item.id,
          issue: errorMessage,
          variant: item.variant,
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      summary: {
        totalValidItems: validItems,
        totalInvalidItems: issues.length,
      },
    };
  }

  async getCartItemsSummary(userId: string): Promise<{
    items: CartItem[];
    totalItems: number;
    totalAmount: number;
    uniqueProducts: number;
    itemsByCategory: Record<string, number>;
  }> {
    const cart = await this.cartRepository.findOne({
      where: { user: { id: userId } },
      relations: [
        'items',
        'items.variant',
        'items.variant.product',
        'items.variant.product.category',
      ],
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return {
        items: [],
        totalItems: 0,
        totalAmount: 0,
        uniqueProducts: 0,
        itemsByCategory: {},
      };
    }

    const itemsByCategory: Record<string, number> = {};
    let totalAmount = 0;
    let totalItems = 0;

    for (const item of cart.items) {
      totalItems += item.quantity;
      totalAmount += item.calculateTotalPrice();

      const categoryName =
        item.variant.product.category?.name || 'Uncategorized';
      itemsByCategory[categoryName] =
        (itemsByCategory[categoryName] || 0) + item.quantity;
    }

    return {
      items: cart.items,
      totalItems,
      totalAmount,
      uniqueProducts: cart.items.length,
      itemsByCategory,
    };
  }
}
