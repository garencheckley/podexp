import express from 'express';

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Test server is running on port ${port}`);
}); 