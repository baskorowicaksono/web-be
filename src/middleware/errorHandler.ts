import { Request, Response, NextFunction } from "express";

export const errorHandler = (
    error: Error,
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    console.error(error.stack);

    res.status(500).json({
        message: "Internal Server Error!",
        error: process.env.NODE_ENV === "production" ? {} : error.message
    })
}