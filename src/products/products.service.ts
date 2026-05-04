import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaService } from 'src/database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(createProductDto: CreateProductDto) {
    return await this.prisma.products.create({
      data: createProductDto,
    });
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 50 } = paginationDto;
    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.products.count(),
      this.prisma.products.findMany({
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.products.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produto não encontrado');
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.prisma.products.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produto não encontrado');

    return await this.prisma.products.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(id: string) {
    const product = await this.prisma.products.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produto não encontrado');

    return await this.prisma.products.delete({
      where: { id },
    });
  }
}
