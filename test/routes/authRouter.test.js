const request = require('supertest');
const app = require('../../src/service');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  await request(app).post('/api/auth').send(testUser);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] };
  expect(password).toMatch(testUser.password);
  expect(loginRes.body.user).toMatchObject(user);
});

test('login fail', async () => {
    const response = await request(app)
        .put('/api/auth')
        .send({ name: 'invalid', email: 'invalid@jwt.com', password: 'wrongpassword' });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe('unknown user');
});