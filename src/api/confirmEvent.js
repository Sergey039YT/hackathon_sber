import checkProps from '../checkProps.js';
import { dbGet, dbRun } from '../db.js';

export async function post(db, { userId, body }) {
    if (userId === null) return [401, { error: 'Пользователь не авторизован.' }];
    const [{ role }] = await dbGet(db, 'SELECT role FROM users WHERE id = ?', userId);
    if (role < 2) return [403, { error: 'Недостаточно прав для совершения действия.' }];
    const check = checkProps(['id', 'accepted'], body);
    if (check) return [400, { error: check }];

    const [, { changes }] = await dbRun(db, 'UPDATE events SET confirmed = 1, accepted = ? WHERE id = ?', body.accepted, body.id);
    if (changes === 0) return [404, { error: 'Событие не найдено.' }];
    return [200, {}];
}