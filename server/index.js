import { readFile } from 'fs/promises';
import { createServer } from 'http';
import sqlite3 from 'sqlite3';
import { gzip } from 'zlib';
import createTables from './createDB.js';
import { dbGet, dbRun } from './db.js';
import { getSession } from './session.js';
import initTelegramBot from './telegramBot.js';
import { hashPassword } from './utils.js';

const db = new sqlite3.Database('database.db');
await createTables(db);

dbGet(db, 'SELECT COUNT(*) as num FROM users').then(function([{ num }]) {
    if (num) return;
    dbRun(db, 'INSERT INTO users (role, email, password, first_name, second_name, third_name, country, city) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 2, 'admin@mail.ru', hashPassword('admin'), 'Главный', 'Админ', '', '-', '-');
});

// debug
await dbRun(db, 'INSERT INTO tags (name, color) VALUES (?, ?)', 'Программирование', '0,17,229');
await dbRun(db, 'INSERT INTO tags (name, color) VALUES (?, ?)', 'Семья', '255,6,222');
await dbRun(db, 'INSERT INTO tags (name, color) VALUES (?, ?)', 'Окружение', '0,228,36');
await dbRun(db, 'INSERT INTO events (creator, time, duration, title, description, location) VALUES (?, ?, ?, ?, ?, ?)', 0, 1726714800, 60 * 20, 'Хакатон от Кроны - открытие', 'Участники будут работать над созданием инновационных решений, которые помогут улучшить управление событиями, повысить эффективность коммуникации и оптимизировать процессы внутри клуба. В ходе хакатона команды будут иметь возможность консультироваться с экспертами, получать обратную связь и совершенствовать свои проекты.', 'Школа 21');
await dbRun(db, 'INSERT INTO events (creator, time, duration, title, description, location, accepted, confirmed) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 0, 1727002800, 60 * 60, 'Хакатон от Кроны - закрытие', 'Событие, где мы получим последнее место :(', 'Школа 21', 1, 1);
await dbRun(db, 'INSERT INTO event_tags (event_id, tag_id) VALUES (?, ?)', 1, 1);
await dbRun(db, 'INSERT INTO event_tags (event_id, tag_id) VALUES (?, ?)', 2, 1);

initTelegramBot(db);

const types = {
    txt: 'text/plain; charset=utf-8',
    html: 'text/html; charset=utf-8',
    css: 'text/css',
    js: 'application/javascript',
    webp: 'image/webp',
    ico: 'image/x-icon',
    svg: 'image/svg+xml',
    ttf: 'font/ttf'
};

createServer(function(req, res) {
    function send(code, headers, data) {
        if (req.headers['accept-encoding']?.includes('gzip')) {
            res.setHeader('Content-Encoding', 'gzip');
            res.writeHead(code, headers);
            gzip(data, (err, data) => res.end(data));
        }
        else res.writeHead(code, headers).end(data);
    }

    const url = new URL(req.url, 'http://127.0.0.1');
    let path = url.pathname;

    let token = null;
    if (req.headers.cookie?.includes('sessionToken=')) {
        token = req.headers.cookie.match(/sessionToken=([^;]+)/)[1];
    }

    if (path.startsWith('/api/')) {
        const search = Object.fromEntries(url.search.slice(1).split('&').map(a => a.split('=').map(b => decodeURIComponent(b))));
        import(`./api/${path.slice(5)}.js`).then(async function(module) {
            const method = req.method.toLowerCase();
            if (method in module) {
                const body = await new Promise(function(resolve) {
                    let b = '';
                    req.on('data', chunk => b += chunk);
                    req.on('end', () => resolve(b));
                });

                let parsedBody = undefined;
                if (req.headers['content-type']?.includes('application/json')) {
                    try {
                        parsedBody = JSON.parse(body);
                    }
                    catch (e) {
                        return send(400, { 'Content-Type': 'application/json' }, JSON.stringify({ error: 'Тело запроса не является JSON.' }));
                    }
                }

                const [code, resp, cookies] = await module[method](db, {
                    userId: await getSession(db, token),
                    search, token,
                    body: parsedBody
                });
                send(code, {
                    'Content-Type': 'application/json',
                    'Set-Cookie': cookies ? Object.entries(cookies).map(([k, v]) => `${k}=${v}; Path=/`) : []
                }, JSON.stringify(resp));
            }
            else res.writeHead(405).end();
        }, () => res.writeHead(404).end());
    }
    else {
        if (req.method !== 'GET') {
            res.writeHead(405).end();
            return;
        }

        if (!path.includes('/')) path = '/index.html';
        readFile('./public' + path).catch(() => (path = '/index.html', readFile('./public' + path))).then(function(data) {
            send(200, { 'Content-Type': types[path.split('.').pop()] || types.txt }, data);
        }, () => res.writeHead(500).end());
    }
}).listen(80);

setInterval(function() {
    dbRun(db, 'DELETE FROM sessions WHERE expires <= ?', Date.now());
    dbRun(db, 'DELETE FROM telegram_auth WHERE expires <= ?', Date.now());
}, 60_000);