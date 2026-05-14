import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SellProductDto } from './dto/sell-product.dto';
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

  async sellProduct(dto: SellProductDto) {
    const product = await this.prisma.products.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');

    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `Estoque insuficiente para "${product.name}". Disponível: ${product.stock}, Solicitado: ${dto.quantity}.`,
      );
    }

    const unitPrice = dto.unitPrice ?? product.price;
    const totalAmount = unitPrice * dto.quantity;

    return await this.prisma.$transaction(async (tx) => {
      // 1. Decrementar estoque
      await tx.products.update({
        where: { id: dto.productId },
        data: { stock: { decrement: dto.quantity } },
      });

      // 2. Lançar entrada no caixa
      const transaction = await tx.cashFlowTransaction.create({
        data: {
          type: 'INCOME',
          category: 'VENDA_PRODUTO',
          status: 'PAID',
          description: `Venda PDV - ${product.name} (x${dto.quantity})`,
          amount: totalAmount,
          paymentMethod: dto.paymentMethod,
        },
      });

      return {
        message: 'Venda registrada com sucesso.',
        product: product.name,
        quantity: dto.quantity,
        unitPrice,
        totalAmount,
        paymentMethod: dto.paymentMethod ?? null,
        cashFlowTransactionId: transaction.id,
      };
    });
  }
}
