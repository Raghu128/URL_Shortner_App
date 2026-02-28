import { User } from '@prisma/client';
import { prismaRead, prismaWrite } from '../../infrastructure/database/prismaClient';

/**
 * Auth/User Repository — Data access layer.
 * Read/write split: reads → replica, writes → primary.
 */
export class AuthRepository {
    // ─── READS → Replica ───

    async findByEmail(email: string): Promise<User | null> {
        return prismaRead.user.findUnique({
            where: { email },
        });
    }

    async findById(id: bigint): Promise<User | null> {
        return prismaRead.user.findUnique({
            where: { id },
        });
    }

    // ─── WRITES → Primary ───

    async create(data: {
        email: string;
        passwordHash: string;
        name?: string;
    }): Promise<User> {
        return prismaWrite.user.create({
            data: {
                email: data.email,
                passwordHash: data.passwordHash,
                name: data.name || null,
            },
        });
    }
}
