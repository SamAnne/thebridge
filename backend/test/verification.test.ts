import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server';
import jwt from 'jsonwebtoken';


// invalid token
test('should reject invalid token', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const res = await request(app).get('/verify?token=invalidtoken')
    //assert.equal(res.status, 200);
    assert.equal(res.body.error, 'Invalid or expired token');
})

// verify rejects expired token
test('should reject expired token', async () => {
  const token = jwt.sign({ email: 'test@nebo.edu' }, process.env.JWT_SECRET!, { expiresIn: '0s' });
  const res = await request(app)
    .get(`/verify?token=${token}`);

  assert.equal(res.body.error, 'Invalid or expired token');
})


// invalid domain rejected on register
test('should reject non school email', async () => {
  const res = await request(app)
    .post('/signup')
    .send({ email: 'test@gmail.com', password: 'password123', name: 'test' })

  assert.equal(res.body.error, 'Invalid email.')
})
