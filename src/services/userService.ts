import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = PrismaClient();

export const userService = {

    async createUser(data: any){
        const hash_password = await bcrypt.hash(data.password, 10);

        return await prisma.user.create({
            data : {
                ...data,
                password: hash_password,
            },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            }
        });
    },

    async getAllUsers(){
        return await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true,
            }
        })
    }
}