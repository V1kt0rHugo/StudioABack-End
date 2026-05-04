import { Injectable } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { PrismaService } from 'src/database/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}
  async create(createServiceDto: CreateServiceDto) {
    const service = await this.prisma.services.create({
      data: {
        name: createServiceDto.name,
        price: createServiceDto.price,
      },
    });
    return service;
  }

  async findAll(paginationDto: PaginationDto) {
    const { page = 1, limit = 50 } = paginationDto;
    const skip = (page - 1) * limit;

    const [total, data] = await this.prisma.$transaction([
      this.prisma.services.count(),
      this.prisma.services.findMany({
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

  findOne(id: string) {
    return this.prisma.services.findUnique({
      where: { id },
    });
  }

  update(id: string, updateServiceDto: UpdateServiceDto) {
    return this.prisma.services.update({
      where: { id },
      data: updateServiceDto,
    });
  }

  remove(id: string) {
    return this.prisma.services.delete({
      where: { id },
    });
  }
}
