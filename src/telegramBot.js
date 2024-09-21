import { request } from 'https';
import { dbGet, dbRun } from './db.js';

const TELEGRAM_TOKEN = '7212456462:AAEGw79rGEFC_kaJNb5Cr6wI6UD_UJwGGaA';

function botApi(name, data) {
    return new Promise(function(resolve, reject) {
        const req = request({
            method: 'POST',
            host: 'api.telegram.org',
            path: `/bot${TELEGRAM_TOKEN}/${name}`,
            headers: { 'Content-Type': 'application/json' }
        }, function(res) {
            res.setEncoding('utf8');
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.end(JSON.stringify(data));
    });
}

function sendMessage(chatId, text) {
    return botApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}
export function sendMessageWithKeyboard(chatId, text) {
    return botApi('sendMessage', {
        chat_id: chatId, text, parse_mode: 'HTML', reply_markup: {
            keyboard: [
                ['👤 О пользователе'],
                ['❌ Отвязать аккаунт']
            ]
        }
    });
}

export default async function initTelegramBot(db) {
    let offset = 0;
    while (true) {
        const { ok, result } = await botApi('getUpdates', { offset, timeout: 5000 });
        if (ok) {
            offset += result.length;
            for (const { update_id, message } of result) {
                dbGet(db, 'SELECT * FROM users WHERE telegram = ?', message.from.id).then(async function([user]) {
                    switch (message.text) {
                        case '/start':
                            await (user ? sendMessageWithKeyboard : sendMessage)(message.chat.id, '<b>Об этом боте:</b>\nБот рассказывает вам о интересных событиях Кроны. Отметьте интересные категории и отметьте "Уведомления в телеграм" на сайте, чтобы получать уведомления о событиях.');
                            break;
                        case '👤 О пользователе':
                            if (!user) return sendMessage(message.chat.id, 'Этот телеграм не привязан к аккаунту.');
                            sendMessageWithKeyboard(message.chat.id, `<u><b>Информация о пользователе:</b></u>
<b>ФИО:</b> ${user.first_name} ${user.second_name} ${user.third_name}
<b>Почта:</b> ${user.email ?? '&lt;нет&gt;'}
<b>Роль:</b> ${['пользователь', 'резидент', 'администратор'][user.role]}
<b>Город:</b> ${user.city}
<b>Страна:</b> ${user.country}`, { parse_mode: 'HTML' });
                            break;
                        case '❌ Отвязать аккаунт':
                            if (!user) return sendMessage(message.chat.id, 'Этот телеграм не привязан к аккаунту.');
                            if (user.password === null) return sendMessageWithKeyboard(message.chat.id, 'Вы не можете отвязать телеграм от аккаунта без пароля.');
                            dbRun(db, 'UPDATE users SET telegram = NULL WHERE id = ?', user.id);
                            sendMessage(message.chat.id, 'Вы успешно отвязали свой аккаунт.');
                            break;
                        default:
                            if (/^[0-9a-f]{32}$/.test(message.text)) {
                                dbGet(db, 'SELECT type, telegram FROM telegram_auth WHERE code = ?', message.text).then(async function([auth]) {
                                    if (!auth) return sendMessage(message.chat.id, 'Код недействителен.');
                                    if (auth.telegram !== null) return sendMessage(message.chat.id, 'Вы уже вводили этот код.');
                                    if (auth.type === 1) { // register
                                        const [user] = await dbGet(db, 'SELECT id FROM users WHERE telegram = ?', message.from.id);
                                        if (user) return sendMessageWithKeyboard(message.chat.id, 'Этот телеграм уже привязан к аккаунту.');
                                    }
                                    await dbRun(db, 'UPDATE telegram_auth SET telegram = ? WHERE code = ?', message.from.id, message.text);
                                    sendMessageWithKeyboard(message.chat.id, `Вы успешно ${['вошли в систему', 'зарегистрировались'][auth.type]}. Вернитесь на страницу входа и нажмите кнопку "Продолжить".`);
                                });
                            }
                            else (user ? sendMessageWithKeyboard : sendMessage)(message.chat.id, 'Я не понял, что вы хотите мне сообщить.');
                    }
                });
                offset = update_id + 1;
            }
        }
    }
}