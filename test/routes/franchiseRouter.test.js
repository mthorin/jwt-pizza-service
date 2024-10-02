const request = require('supertest');
const app = require('../../src/service');
const { DB, Role } = require('../../src/database/database');

let adminToken;
let adminEmail;
let userToken;
let adminId;
let franchiseId;
let storeId;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
  
    const userRet = await DB.addUser(user);
  
    user.password = 'toomanysecrets';
    return [user, userRet];
}

async function createDinerUser() {
    let user = { password: 'secrets', roles: [{ role: Role.Diner }] };
    user.name = randomName();
    user.email = user.name + '@diner.com';
  
    await DB.addUser(user);
  
    user.password = 'secrets';
    return user;
}

beforeAll(async () => {
  // Register an admin user
  const [admin, adminRet] = await createAdminUser()
  const adminRes = await request(app).put('/api/auth').send(admin);

  adminToken = adminRes.body.token;
  adminEmail = admin.email;
  adminId = adminRet.id;

  const user = await createDinerUser()
  const userRes = await request(app).put('/api/auth').send(user);

  userToken = userRes.body.token;
});

test('list all franchises', async () => {
    const response = await request(app)
        .get('/api/franchise');

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
});

test('create', async () => {
    const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'PizzaPlace', admins: [{ email: adminEmail }] });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('PizzaPlace');
    franchiseId = response.body.id;
});

test('create fail', async () => {
    const response = await request(app)
        .post('/api/franchise')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'RegularUserFranchise' });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to create a franchise');
});

test('list a users franchises', async () => {
    const response = await request(app)
        .get(`/api/franchise/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].name).toBe('PizzaPlace');
});

test('create store', async () => {
    const response = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'NewStore', franchiseId });

    expect(response.status).toBe(200);
    expect(response.body.name).toBe('NewStore');
    storeId = response.body.id;
});

test('create store fail', async () => {
    const response = await request(app)
        .post(`/api/franchise/${franchiseId}/store`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'NewStore', franchiseId });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to create a store');
});

test('delete store', async () => {
    const response = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('store deleted');
});

test('delete store fail', async () => {
    const response = await request(app)
        .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
        .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to delete a store');
});

test('delete franchise', async () => {
    const response = await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('franchise deleted');
});

test('delete franchise fail', async () => {
    const response = await request(app)
        .delete(`/api/franchise/${franchiseId}`)
        .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to delete a franchise');
});

