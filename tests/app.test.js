const request = require('supertest');
const app = require('../src/index');

describe('App routes', () => {
  it('GET / should return 200', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
  });

  it('GET / should return correct message', async () => {
    const res = await request(app).get('/');
    expect(res.body.message).toBe('CI/CD Pipeline is live!');
  });

  it('GET /health should return healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});
