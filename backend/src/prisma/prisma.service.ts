// src/prisma/prisma.service.ts
import 'dotenv/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    // Prisma v7 requires an adapter or accelerateUrl; use official Postgres adapter
    super({
      adapter: new PrismaPg({ connectionString: dbUrl }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
