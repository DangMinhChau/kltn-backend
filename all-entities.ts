/**
 * This file contains all entities in the backend system
 */

import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  DeleteDateColumn,
  ManyToOne, 
  OneToMany, 
  ManyToMany, 
  OneToOne, 
  JoinColumn, 
  JoinTable,
  Index,
  Check,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';
import { Exclude } from 'class-transformer';
import * as bcrypt from 'bcryptjs';
import slugify from 'slugify';
import { UserRole } from './src/common/constants/user-role.enum';
import { OrderStatus } from './src/common/constants/order-status.enum';

// ========== Base Entity ==========
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Exclude()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Exclude()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}

// ========== User Module Entities ==========
@Entity('users')
export class User extends BaseEntity {
  @Column({ length: 100 })
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  @Exclude()
  password: string;

  @Column({ length: 100, unique: true })
  phoneNumber: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @OneToMany(() => Address, (address) => address.user)
  addresses: Address[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToOne(() => Cart, (cart) => cart.user)
  cart: Cart;
  
  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }
}

@Entity('addresses')
export class Address extends BaseEntity {
  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  recipientName: string;

  @Column()
  phoneNumber: string;

  @Column()
  streetAddress: string;

  @Column({ length: 50 })
  ward: string;

  @Column({ length: 50 })
  district: string;

  @Column({ length: 50 })
  province: string;

  @Column({ default: false })
  isDefault: boolean;
}

@Entity('tokens')
export class UserToken extends BaseEntity {
  @Column()
  token: string;

  @Column()
  userId: string;

  @Column()
  expires: Date;

  @Column({ default: false })
  isUsed: boolean;
  
  @Column({ length: 50 })
  type: string;
}

// ========== Product Module Entities ==========
@Entity('products')
export class Product extends BaseEntity {
  @Column({ name: 'product_name', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'price', type: 'decimal', precision: 18, scale: 3 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  discount: number; // 0.2 = 20% discount

  @ManyToOne(() => Category, (category) => category.products, {
    nullable: false,
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToMany(() => Collection, (collection) => collection.products, {
    nullable: true,
  })
  collections: Collection[];

  @ManyToMany(() => Style, (style) => style.products, {
    nullable: true,
  })
  styles: Style[];

  @ManyToMany(() => Material, (material) => material.products, {
    nullable: true,
  })
  materials: Material[];

  @ManyToMany(() => Tag, (tag) => tag.products)
  tags: Tag[];

  @Column({ unique: true, length: 200 })
  slug: string;

  @Column({ name: 'sku', unique: true, length: 50 })
  sku: string;

  @OneToMany(() => ProductVariant, (variant) => variant.product, {
    cascade: true,
  })
  variants: ProductVariant[];

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @Column({ default: true })
  isVisible: boolean;

  @Column({ default: true })
  isAvailable: boolean;

  @OneToMany(() => Image, (image) => image.product, { cascade: true })
  images: Image[];

  @BeforeInsert()
  @BeforeUpdate()
  slugifyName() {
    if (this.name) {
      this.slug = slugify(this.name, { lower: true });
    }
  }
}

@Entity('categories')
export class Category extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 200, unique: true })
  slug: string;

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Category;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @BeforeInsert()
  @BeforeUpdate()
  slugifyName() {
    if (this.name) {
      this.slug = slugify(this.name, { lower: true });
    }
  }
}

@Entity('collections')
export class Collection extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 200, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToMany(() => Product, (product) => product.collections)
  @JoinTable({
    name: 'collection_products',
    joinColumn: { name: 'collection_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'product_id', referencedColumnName: 'id' },
  })
  products: Product[];

  @BeforeInsert()
  @BeforeUpdate()
  slugifyName() {
    if (this.name) {
      this.slug = slugify(this.name, { lower: true });
    }
  }
}

@Entity('product_variants')
export class ProductVariant extends BaseEntity {
  @Column({ name: 'sku', length: 50, unique: true })
  sku: string;

  @Column({ name: 'price', type: 'decimal', precision: 18, scale: 3 })
  price: number;

  @Column({ name: 'stock_quantity', type: 'int', default: 0 })
  stockQuantity: number;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Color, (color) => color.variants, { nullable: true })
  @JoinColumn({ name: 'color_id' })
  color: Color;

  @ManyToOne(() => Size, (size) => size.variants, { nullable: true })
  @JoinColumn({ name: 'size_id' })
  size: Size;
}

@Entity('colors')
export class Color extends BaseEntity {
  @Column({ length: 50 })
  name: string;

  @Column({ length: 7 })
  hexCode: string;

  @OneToMany(() => ProductVariant, (variant) => variant.color)
  variants: ProductVariant[];
}

@Entity('sizes')
export class Size extends BaseEntity {
  @Column({ length: 20 })
  name: string;

  @Column({ type: 'int' })
  sortOrder: number;

  @OneToMany(() => ProductVariant, (variant) => variant.size)
  variants: ProductVariant[];
}

@Entity('materials')
export class Material extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 200, unique: true })
  slug: string;

  @ManyToMany(() => Product, (product) => product.materials)
  @JoinTable({
    name: 'product_materials',
    joinColumn: { name: 'material_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'product_id', referencedColumnName: 'id' },
  })
  products: Product[];
}

@Entity('styles')
export class Style extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ length: 200, unique: true })
  slug: string;

  @ManyToMany(() => Product, (product) => product.styles)
  @JoinTable({
    name: 'product_styles',
    joinColumn: { name: 'style_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'product_id', referencedColumnName: 'id' },
  })
  products: Product[];
}

@Entity('tags')
export class Tag extends BaseEntity {
  @Column({ length: 50 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @ManyToMany(() => Product, (product) => product.tags)
  @JoinTable({
    name: 'product_tags',
    joinColumn: { name: 'tag_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'product_id', referencedColumnName: 'id' },
  })
  products: Product[];
}

@Entity('images')
export class Image extends BaseEntity {
  @Column()
  url: string;

  @Column({ nullable: true })
  alt: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Product, (product) => product.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}

// ========== Cart Module Entities ==========
@Entity('carts')
export class Cart extends BaseEntity {
  @OneToOne(() => User, (user) => user.cart, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => CartItem, (item) => item.cart, { cascade: true })
  items: CartItem[];
}

@Entity('cart_items')
export class CartItem extends BaseEntity {
  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'int', default: 1 })
  quantity: number;
}

@Entity('wishlists')
export class Wishlist extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}

// ========== Order Module Entities ==========
@Entity('orders')
@Index(['status', 'orderedAt'])
@Index(['user', 'status'])
@Check(`"total_price" >= 0`)
@Check(`"sub_total" >= 0`)
export class Order extends BaseEntity {
  @Column({ length: 50, unique: true })
  orderNumber: string;

  @ManyToOne(() => User, (user) => user.orders, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @Index()
  user: User;

  @Column()
  customerName: string;

  @Column()
  customerEmail: string;

  @Column()
  customerPhone: string;

  @Column()
  shippingAddress: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @CreateDateColumn({ name: 'ordered_at' })
  orderedAt: Date;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'sub_total' })
  subTotal: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, name: 'total_price' })
  totalPrice: number;

  @ManyToOne(() => Voucher, { nullable: true })
  @JoinColumn({ name: 'voucher_id' })
  voucher: Voucher;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  discount: number;

  @OneToOne(() => Payment, (payment) => payment.order)
  payment: Payment;

  @OneToOne(() => Shipping, (shipping) => shipping.order)
  shipping: Shipping;
}

@Entity('order_items')
export class OrderItem extends BaseEntity {
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'product_name', length: 255 })
  productName: string;

  @Column({ nullable: true })
  sku: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  size: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  price: number;

  @Column({ type: 'int' })
  quantity: number;
}

@Entity('payments')
export class Payment extends BaseEntity {
  @OneToOne(() => Order, (order) => order.payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ length: 50 })
  paymentMethod: string;

  @Column({ length: 100, nullable: true })
  transactionId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ default: false })
  isPaid: boolean;

  @Column({ nullable: true })
  paidAt: Date;
}

@Entity('shippings')
export class Shipping extends BaseEntity {
  @OneToOne(() => Order, (order) => order.shipping, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ length: 50 })
  carrier: string;

  @Column({ length: 100, nullable: true })
  trackingNumber: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  cost: number;

  @Column({ nullable: true })
  shippedAt: Date;

  @Column({ nullable: true })
  deliveredAt: Date;
}

@Entity('webhook_events')
export class WebhookEvent extends BaseEntity {
  @Column()
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ default: false })
  processed: boolean;

  @Column({ nullable: true })
  processedAt: Date;
  
  @Column({ nullable: true, type: 'text' })
  error: string;
}

// ========== Review Module Entities ==========
@Entity('reviews')
export class Review extends BaseEntity {
  @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Product, (product) => product.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ default: true })
  isVisible: boolean;
}

// ========== Promotion Module Entities ==========
@Entity('vouchers')
export class Voucher extends BaseEntity {
  @Column({ length: 100 })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  percentDiscount: number; // 0.2 = 20% discount

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    name: 'fixed_discount',
    nullable: true,
  })
  fixedDiscount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  minOrderAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  maxDiscountAmount: number;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @Column({ type: 'int', default: 0 })
  usageLimit: number;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ default: true })
  isActive: boolean;
}

// ========== Notification Module Entities ==========
@Entity('notifications')
export class Notification extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ length: 50 })
  type: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any>;
}
