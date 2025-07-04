
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from "./routes"

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use("/api", routes);


export default app;