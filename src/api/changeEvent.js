import checkProps from '../checkProps.js';
import { dbAll, dbGet, dbRun } from '../db.js';

export async function post(db, { userId, body }) {
    if (userId === null) return [401, { error: 'Пользователь не авторизован.' }];
    const [{ role }] = await dbGet(db, 'SELECT role FROM users WHERE id = ?', userId);
    if (role === 0) return [401, { error: 'Недостаточно прав для совершения действия.' }];
    const check = checkProps(['id', 'title', 'description', 'location', 'time', 'tags'], body);
    if (check) return [400, { error: check }];
    if (role === 1 && (await dbGet(db, 'SELECT creator FROM events WHERE id = ?', body.id))[0].creator !== userId) return [401, { error: 'Недостаточно прав для совершения действия.' }];

    if (!Array.isArray(body.tags)) return [400, { error: 'Неверные теги.' }];
    for (const tag of body.tags) {
        if (!isNoNegInt(tag)) return [400, { error: 'Неверные теги.' }];
    }
    const [numTags] = await dbGet(db, `SELECT COUNT(*) as numTags FROM tags WHERE id IN (${body.tags.map(() => '?').join(', ')})`, ...body.tags);
    if (numTags !== body.tags.length) return [400, { error: 'Неверные теги.' }];

    await dbRun(db, 'UPDATE events SET title = ?, description = ?, location = ?, time_ended = ? WHERE id = ?', body.title, body.description, body.location, body.time, body.id);

    const [tags] = await dbAll(db, 'SELECT tag_id FROM event_tags WHERE event_id = ?', body.id);
    const deleteTags = tags.map(tag => tag.tag_id).filter(tag => !body.tags.includes(tag));
    const addTags = body.tags.filter(tag => !tags.map(tag => tag.tag_id).includes(tag));
    await Promise.all([
        dbRun(db, `DELETE FROM event_tags WHERE event_id IN (${deleteTags.map(() => '?').join(', ')})`, ...deleteTags),
        ...addTags.map(tag => dbRun(db, 'INSERT INTO event_tags (event_id, tag_id) VALUES (?, ?)', body.id, tag))
    ]);

    return [200, {}];
}