const express = require('express');
const sqsRoute = require('../routes/sqs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080

app.use('/reservationSQS', sqsRoute);
app.listen(port, () => console.log(`listening on port ${port}`));
