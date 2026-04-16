import { Injectable } from '@nestjs/common';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) { }
  async create(createServiceDto: CreateServiceDto) {
    const service = await this.prisma.services.create({
      data: {
        name: createServiceDto.name,
        price: createServiceDto.price,
      },
    });
    return service;
  }

  findAll() {
    return this.prisma.services.findMany();
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
