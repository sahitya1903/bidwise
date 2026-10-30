const request = require('supertest');
const app = require('../../src/app');
const { makeUser, auth, PASSWORD } = require('../helpers');

describe('Auth API', () => {
  test('TC-01: register with valid data → 201, no passwordHash in response', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dana', email: 'dana@test.dev', password: 'Password1' });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Dana', email: 'dana@test.dev', role: 'user' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  test('TC-02: register with an email that already exists → 409 EMAIL_TAKEN', async () => {
    await makeUser({ email: 'taken@test.dev' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'TAKEN@test.dev', password: 'Password1' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('register with missing fields → 400 with field messages', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(Object.keys(res.body.error.details.fields)).toEqual(
      expect.arrayContaining(['name', 'email', 'password'])
    );
  });

  test('TC-05: login with correct credentials → 200 with JWT and user', async () => {
    await makeUser({ email: 'bob@test.dev' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@test.dev', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('bob@test.dev');

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('bob@test.dev');
  });

  test('TC-06: login with wrong password → 401 INVALID_CREDENTIALS', async () => {
    await makeUser({ email: 'bob@test.dev' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@test.dev', password: 'wrong-pass' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('GET /auth/me without or with a bad token → 401', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const bad = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token');
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_TOKEN');
  });

  test('TC-08: a normal user calling GET /admin/users → 403; an admin → 200', async () => {
    const user = await makeUser();
    const admin = await makeUser({ role: 'admin' });
    const denied = await request(app).get('/api/admin/users').set(auth(user));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    const ok = await request(app).get('/api/admin/users').set(auth(admin));
    expect(ok.status).toBe(200);
    expect(ok.body.users).toHaveLength(2);
    expect(JSON.stringify(ok.body)).not.toContain('passwordHash');
  });

  test('malformed JSON and unknown routes get the standard error shape', async () => {
    const bad = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{oops');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    const missing = await request(app).get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect((await request(app).get('/api/health')).body.ok).toBe(true);
  });
});
