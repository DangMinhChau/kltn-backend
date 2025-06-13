import { ApiProperty } from '@nestjs/swagger';

export class WebhookOverviewDto {
  @ApiProperty({ description: 'Trạng thái webhook', example: 'healthy' })
  status: string;

  @ApiProperty({ description: 'Danh sách vấn đề', type: [String], example: [] })
  issues: string[];

  @ApiProperty({ description: 'Khoảng thời gian', example: '24 hours' })
  period: string;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2024-06-10T10:00:00.000Z',
  })
  generatedAt: string;
}

export class WebhookCurrentMetricsDto {
  @ApiProperty({ description: 'Tổng số yêu cầu', example: 150 })
  totalRequests: number;

  @ApiProperty({ description: 'Số yêu cầu thành công', example: 148 })
  successfulRequests: number;

  @ApiProperty({ description: 'Số yêu cầu thất bại', example: 2 })
  failedRequests: number;

  @ApiProperty({
    description: 'Thời gian phản hồi trung bình (ms)',
    example: 120,
  })
  averageResponseTime: number;
}

export class WebhookDatabaseMetricsDto {
  @ApiProperty({ description: 'Tổng số sự kiện', example: 150 })
  totalEvents: number;

  @ApiProperty({ description: 'Tỷ lệ thành công (%)', example: 98.67 })
  successRate: number;

  @ApiProperty({ description: 'Tỷ lệ lỗi (%)', example: 1.33 })
  errorRate: number;
}

export class WebhookPerformanceMetricsDto {
  @ApiProperty({ description: 'Độ trễ trung bình (ms)', example: 125 })
  averageLatency: number;

  @ApiProperty({ description: 'Độ trễ tối đa (ms)', example: 500 })
  maxLatency: number;

  @ApiProperty({ description: 'Số lượng yêu cầu mỗi phút', example: 25 })
  requestsPerMinute: number;
}

export class WebhookMetricsDto {
  @ApiProperty({
    description: 'Metrics hiện tại',
    type: WebhookCurrentMetricsDto,
  })
  current: WebhookCurrentMetricsDto;

  @ApiProperty({
    description: 'Metrics cơ sở dữ liệu',
    type: WebhookDatabaseMetricsDto,
  })
  database: WebhookDatabaseMetricsDto;

  @ApiProperty({
    description: 'Metrics hiệu suất',
    type: WebhookPerformanceMetricsDto,
  })
  performance: WebhookPerformanceMetricsDto;
}

export class WebhookRecentEventDto {
  @ApiProperty({ description: 'ID sự kiện', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Loại sự kiện', example: 'payment.success' })
  type: string;

  @ApiProperty({ description: 'Trạng thái', example: 'success' })
  status: string;

  @ApiProperty({
    description: 'Thời gian',
    example: '2024-06-10T09:45:00.000Z',
  })
  timestamp: string;
}

export class WebhookCleanupDto {
  @ApiProperty({
    description: 'Lần dọn dẹp cuối cùng',
    example: '2024-06-10T00:00:00.000Z',
  })
  lastCleanup: string;

  @ApiProperty({ description: 'Số bản ghi đã xóa', example: 50 })
  recordsDeleted: number;

  @ApiProperty({
    description: 'Lần dọn dẹp tiếp theo',
    example: '2024-06-11T00:00:00.000Z',
  })
  nextCleanup: string;
}

export class WebhookAlertConfigDto {
  @ApiProperty({
    description: 'Cấu hình cảnh báo',
    type: 'object',
    additionalProperties: true,
  })
  alertConfiguration: object;
}

export class WebhookDashboardOverviewResponseDto {
  @ApiProperty({ description: 'Tổng quan', type: WebhookOverviewDto })
  overview: WebhookOverviewDto;

  @ApiProperty({ description: 'Metrics', type: WebhookMetricsDto })
  metrics: WebhookMetricsDto;

  @ApiProperty({
    description: 'Sự kiện gần đây',
    type: [WebhookRecentEventDto],
  })
  recentEvents: WebhookRecentEventDto[];

  @ApiProperty({ description: 'Trạng thái dọn dẹp', type: WebhookCleanupDto })
  cleanup: WebhookCleanupDto;
  @ApiProperty({
    description: 'Cấu hình cảnh báo',
    type: 'object',
    additionalProperties: true,
  })
  alertConfiguration: object;
}

export class WebhookEventDto {
  @ApiProperty({ description: 'ID sự kiện', example: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'ID đơn hàng',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  orderId: string;

  @ApiProperty({ description: 'Mã phản hồi', example: '00' })
  responseCode: string;

  @ApiProperty({ description: 'Thời gian xử lý (ms)', example: 150 })
  processingTime: number;

  @ApiProperty({ description: 'Trạng thái thành công', example: true })
  success: boolean;

  @ApiProperty({
    description: 'Thời gian',
    example: '2024-06-10T10:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({ description: 'Địa chỉ IP', example: '192.168.1.1' })
  ipAddress: string;

  @ApiProperty({ description: 'User Agent', example: 'Mozilla/5.0...' })
  userAgent: string;

  @ApiProperty({ description: 'Lỗi (nếu có)', example: null, required: false })
  error?: string;
}

export class WebhookEventFiltersDto {
  @ApiProperty({ description: 'ID đơn hàng', required: false, example: null })
  orderId?: string;

  @ApiProperty({
    description: 'Trạng thái thành công',
    required: false,
    example: 'true',
  })
  success?: string;

  @ApiProperty({ description: 'Ngày bắt đầu', required: false, example: null })
  from?: string;

  @ApiProperty({ description: 'Ngày kết thúc', required: false, example: null })
  to?: string;
}

export class WebhookEventsResponseDto {
  @ApiProperty({ description: 'Danh sách sự kiện', type: [WebhookEventDto] })
  events: WebhookEventDto[];

  @ApiProperty({ description: 'Tổng số bản ghi', example: 100 })
  total: number;

  @ApiProperty({ description: 'Trang hiện tại', example: 1 })
  page: number;

  @ApiProperty({ description: 'Số bản ghi mỗi trang', example: 50 })
  limit: number;

  @ApiProperty({
    description: 'Bộ lọc được áp dụng',
    type: WebhookEventFiltersDto,
  })
  filters: WebhookEventFiltersDto;
}

export class WebhookHealthStatusDto {
  @ApiProperty({
    description: 'Trạng thái hệ thống',
    enum: ['healthy', 'warning', 'critical'],
    example: 'healthy',
  })
  status: 'healthy' | 'warning' | 'critical';

  @ApiProperty({
    description: 'Thông báo về trạng thái',
    example: 'Tất cả dịch vụ đang hoạt động bình thường',
  })
  message: string;

  @ApiProperty({ description: 'Danh sách vấn đề', type: [String], example: [] })
  issues: string[];

  @ApiProperty({ description: 'Thời gian hoạt động (giây)', example: 86400 })
  uptime: number;

  @ApiProperty({ description: 'Phiên bản hệ thống', example: '1.0.0' })
  version: string;

  @ApiProperty({
    description: 'Thời gian kiểm tra cuối cùng',
    example: '2024-06-10T10:00:00.000Z',
  })
  lastCheck: string;

  @ApiProperty({
    description: 'Trạng thái các dịch vụ',
    type: 'object',
    properties: {
      database: { type: 'string', example: 'connected' },
      redis: { type: 'string', example: 'connected' },
      external_apis: { type: 'string', example: 'operational' },
    },
  })
  services: {
    database: string;
    redis: string;
    external_apis: string;
  };
}
