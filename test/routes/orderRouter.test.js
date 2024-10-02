const request = require('supertest');
const app = require('../../src/service');
const { DB, Role } = require('../../src/database/database');

let adminToken;
let userToken;
let menuItemId;
let orderId;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
  
    await DB.addUser(user);
  
    user.password = 'toomanysecrets';
    return user;
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
    const admin = await createAdminUser()
    const adminRes = await request(app).put('/api/auth').send(admin);

    adminToken = adminRes.body.token;

    const user = await createDinerUser()
    const userRes = await request(app).put('/api/auth').send(user);

    userToken = userRes.body.token;
});

test('get the pizza menu', async () => {
    const response = await request(app)
        .get('/api/order/menu');

    expect(response.status).toBe(200);
    //expect(response.body.length).toBeGreaterThan(0);
    expect(response.body).toBe([]);
});

test('add', async () => {
    const response = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Veggie', description: 'A garden of delight', image: 'pizza1.png', price: 0.0038 });

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].title).toBe('Veggie');
    menuItemId = response.body[0].id;
});

test('add fail', async () => {
    const response = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Meat Lovers', description: 'Carnivore dream', image: 'pizza2.png', price: 0.004 });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe('unable to add menu item');
});

test('create order', async () => {
    const response = await request(app)
        .post('/api/order')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
        franchiseId: 1,
        storeId: 1,
        items: [
            { menuId: menuItemId, description: 'Veggie', price: 0.0038 },
        ],
        });

    expect(response.status).toBe(200);
    expect(response.body.order.items.length).toBe(1);
    expect(response.body.order.items[0].description).toBe('Veggie');
    orderId = response.body.order.id;
});

test('get order', async () => {
    const response = await request(app)
        .get('/api/order')
        .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.orders.length).toBeGreaterThan(0);
    expect(response.body.orders[0].id).toBe(orderId);
});