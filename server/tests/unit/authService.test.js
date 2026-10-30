const jwt = require('jsonwebtoken');
const authService = require('../../src/services/authService');
const env = require('../../src/config/env');
const { makeUser } = require('../helpers');

const valid = { name: 'Dana', email: 'dana@test.dev', password: 'abcdefgh' };

describe('authService', () => {
  test('TC-03: password of 7 characters is rejected (400)', async () => {
    await expect(authService.register({ ...valid, password: 'abcdefg' })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  test('TC-04: password of exactly 8 characters is accepted', async () => {
    const { user, token } = await authService.register(valid);
    expect(user.email).toBe('dana@test.dev');
    expect(token).toEqual(expect.any(String));
    expect(user.toJSON().passwordHash).toBeUndefined();
  });

  test('email is stored in lower case and must be unique (409)', async () => {
    await authService.register({ ...valid, email: 'Dana@Test.dev' });
    await expect(authService.register(valid)).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  test('invalid email format is rejected (400)', async () => {
    await expect(authService.register({ ...valid, email: 'not-an-email' })).rejects.toMatchObject({
      status: 400,
    });
  });

  test('login works with the right password and fails with a wrong one or unknown email', async () => {
    await authService.register(valid);
    const ok = await authService.login({ email: valid.email, password: valid.password });
    expect(ok.user.name).toBe('Dana');
    await expect(authService.login({ email: valid.email, password: 'wrongpass' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    await expect(
      authService.login({ email: 'nobody@test.dev', password: 'whatever1' })
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  test('verifyToken returns the user for a valid token and 401 for bad ones', async () => {
    const user = await makeUser({ name: 'Eve' });
    const found = await authService.verifyToken(user.token);
    expect(found._id.equals(user._id)).toBe(true);

    await expect(authService.verifyToken('garbage')).rejects.toMatchObject({ status: 401 });
    const expired = jwt.sign({ sub: user._id.toString() }, env.jwtSecret, { expiresIn: -10 });
    await expect(authService.verifyToken(expired)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_TOKEN',
    });
    const otherSecret = jwt.sign({ sub: user._id.toString() }, 'another-secret');
    await expect(authService.verifyToken(otherSecret)).rejects.toMatchObject({ status: 401 });
    const badSub = jwt.sign({ sub: 'not-an-id' }, env.jwtSecret);
    await expect(authService.verifyToken(badSub)).rejects.toMatchObject({ status: 401 });
  });

  test('verifyToken rejects a token for a deleted user', async () => {
    const user = await makeUser();
    await user.deleteOne();
    await expect(authService.verifyToken(user.token)).rejects.toMatchObject({ status: 401 });
  });

  test('listUsers returns users without password hashes', async () => {
    await makeUser();
    await makeUser({ role: 'admin' });
    const users = await authService.listUsers();
    expect(users).toHaveLength(2);
    expect(JSON.parse(JSON.stringify(users))[0].passwordHash).toBeUndefined();
  });
});
