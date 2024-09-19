import { createHash } from 'crypto';
import checkProps from '../checkProps.js';
import { dbGet, dbRun } from '../db.js';
import { createSession } from '../session.js';

export async function post(db, { userId, body }) {
    if (userId !== null) return [401, { error: 'Вы уже вошли в систему.' }];
    const check = checkProps(['email', 'firstName', 'secondName', 'thirdName', 'password', 'password2'], body);
    if (check) return [400, { error: check }];

    if ((await dbGet(db, 'SELECT * FROM users WHERE email = ?', body.email))[0]) return [401, { error: 'Такой пользователь уже существует.' }];
    if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(body.email)) return [401, { error: 'Некорректная почта.' }];
    if (body.password !== body.password2) return [401, { error: 'Пароли не совпадают.' }];

    const [, { lastID }] = await dbRun(db, 'INSERT INTO users (email, first_name, second_name, third_name, password) VALUES (?, ?, ?, ?, ?)', body.email, body.firstName, body.secondName, body.thirdName, createHash('sha256').update(body.password).digest('hex'));

    const [token, expires] = await createSession(db, lastID);
    return [200, {}, {
        sessionToken: `${token}; Expires=${expires}`
    }];
}