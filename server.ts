import app from "./src/app"
import dotenv from 'dotenv'
dotenv.config();

const port = process.env.PORT || 9000;

app.listen(port, () => {
    console.log(`Server is running at port ${port}`)
})