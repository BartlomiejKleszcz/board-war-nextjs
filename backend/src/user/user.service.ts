import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createWithPlayer(dto: RegisterDto, passwordHash: string) {
    const lowerEmail = dto.email.toLowerCase();

    const { user, player } = await this.prisma.$transaction(async (tx) => {
      const player = await tx.player.create({
        data: {
          name: dto.displayName,
          color: dto.color,
        },
      });

      const user = await tx.user.create({
        data: {
          id: player.id,
          email: lowerEmail,
          passwordHash,
          displayName: dto.displayName,
        },
      });

      return { user, player };
    });

    return { user, player };
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  toSafeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }
}
