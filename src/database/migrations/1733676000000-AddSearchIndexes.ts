import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSearchIndexes1733676000000 implements MigrationInterface {
  name = 'AddSearchIndexes1733676000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add GIN indexes for better text search performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_name_gin" ON "product" 
      USING gin(to_tsvector('english', name));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_description_gin" ON "product" 
      USING gin(to_tsvector('english', description));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_sku_gin" ON "product" 
      USING gin(to_tsvector('english', "baseSku"));
    `);

    // Add regular indexes for commonly searched fields
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_name_lower" ON "product" 
      (LOWER(name));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_sku_lower" ON "product" 
      (LOWER("baseSku"));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_category_name_lower" ON "category" 
      (LOWER(name));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_material_name_lower" ON "material" 
      (LOWER(name));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collection_name_lower" ON "collection" 
      (LOWER(name));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_style_name_lower" ON "style" 
      (LOWER(name));
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tag_name_lower" ON "tag" 
      (LOWER(name));
    `);

    // Composite indexes for commonly used filter combinations
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_active_created" ON "product" 
      ("isActive", "createdAt" DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_active_category" ON "product" 
      ("isActive", "categoryId");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_product_active_price" ON "product" 
      ("isActive", "basePrice");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all created indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_name_gin"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_description_gin"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_sku_gin"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_name_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_sku_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_category_name_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_material_name_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_collection_name_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_style_name_lower"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tag_name_lower"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_active_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_product_active_category"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_active_price"`);
  }
}
