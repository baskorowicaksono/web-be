import { Request, Response, NextFunction } from "express";
import { userService } from "../services/userService";

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const users = await userService.getAllUsers();
        res.json(users);
    } catch(error){
        next(error);
    }
};

export const createNewUser = async(req: Request, res: Response, next: NextFunction) => {
    try{
        const { email, password, name } = req.body;
        const user = await userService.createUser({email, password, name});
        res.status(201).json(user);
    } catch(error){
        next(error);
    }
}