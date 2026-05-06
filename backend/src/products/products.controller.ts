import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, CreateCategoryDto } from './dto/product.dto';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../auth/decorators/current-user.decorator';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermissions('product.view')
  @ApiOperation({ summary: 'List/search products' })
  list(
    @Query('q') q?: string,
    @Query('categoryId') categoryId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('all') all?: string,
  ) {
    return this.products.list({
      q,
      categoryId,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      activeOnly: all !== 'true',
    });
  }

  @Get('barcode/:code')
  @RequirePermissions('product.view')
  byBarcode(@Param('code') code: string) {
    return this.products.findByBarcode(code);
  }

  @Get('categories')
  @RequirePermissions('product.view')
  listCategories() {
    return this.products.listCategories();
  }

  @Post('categories')
  @RequirePermissions('product.manage')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.products.createCategory(dto);
  }

  @Get(':id')
  @RequirePermissions('product.view')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.getById(id);
  }

  @Post()
  @RequirePermissions('product.manage')
  create(@Body() dto: CreateProductDto, @CurrentUser() me: JwtUser) {
    return this.products.create(dto, me.userId);
  }

  @Patch(':id')
  @RequirePermissions('product.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() me: JwtUser,
  ) {
    return this.products.update(id, dto, me.userId);
  }
}
