import { BaseEntity } from 'src/common/classes/base.entity';
import { Column, Entity, Index } from 'typeorm';

@Entity('webhook_events')
@Index(['orderId'])
@Index(['responseCode'])
@Index(['success'])
@Index(['timestamp'])
@Index(['orderId', 'timestamp'])
export class WebhookEvent extends BaseEntity {
  @Column({ length: 100 })
  orderId: string;

  @Column({ length: 10 })
  responseCode: string;

  @Column({ type: 'int' })
  processingTime: number;

  @Column({ type: 'boolean' })
  success: boolean;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ length: 45, nullable: true })
  ipAddress: string;

  @Column({ length: 500, nullable: true })
  userAgent: string;

  @Column({ length: 100, nullable: true })
  webhookId: string;
}
