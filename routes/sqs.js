const router = require('express').Router();
const { createQ, readQ, deleteMessage } = require('../server/sqs');

router.get('/create', (req, res) => {
  createQ()
    .then(data => res.status(200).send(data.QueueUrl))
    .catch(err => res.status(400).send(err));
});

router.get('/read', (req, res) => {
  readQ()
    .then((data) => {
      if (data.Messages) {
        console.log(data);
        deleteMessage(data)
          .then(response => res.send('Message deleted', response))
          .catch(err => res.send('Error deleting message', err));
      }
    })
    .catch(err => res.send('Error occured receiving messages', err));
});

module.exports = router;
