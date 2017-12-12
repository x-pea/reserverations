import express from 'express';
import sqsRoute from '../routes/sqs';
import { config } from 'dotenv';

const app = express();
const port = process.env.PORT || 8080

app.use('/reservationSQS', sqsRoute);
app.listen(port, () => console.log(`listening on port ${port}`));
