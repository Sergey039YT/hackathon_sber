function createCalendar(root) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // Текущий месяц (0 - январь, 11 - декабрь)

    const firstDayOfMonth = new Date(year, month, 1); // Первый день месяца
    const lastDayOfMonth = new Date(year, month + 1, 0); // Последний день месяца

    let row = document.createElement('tr');

    const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7; // Преобразование дня недели (чтобы Пн был 0)
    for (let i = 0; i < firstDayWeekday; i++) {
        row.appendChild(document.createElement('td'));
    }

    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
        const td = document.createElement('td');
        td.textContent = day;
        row.appendChild(td);
        if ((day + firstDayWeekday) % 7 === 0) {
            root.appendChild(row);
            row = document.createElement('tr');
        }
    }

    for (let i = 0; i < 7 - lastDayOfMonth.getDay(); i++) {
        const td = document.createElement('td');
        row.appendChild(td);
    }
    root.appendChild(row);
}

createCalendar(document.getElementById('calendar-root'));

function getApi(name, data = {}) {
    return fetch(`/api/${name}?` + Object.entries(data).map(([k, v]) => `${k}=${v}`).join('&')).then(r => r.json());
}
function postApi(name, data = {}) {
    return fetch('/api/' + name, { method: 'POST', body: JSON.stringify(data) }).then(r => r.json());
}

let tags = [];
async function selectTag(tag) {
    if (tags.includes(tag)) { tags.splice(tags.indexOf(tag), 1); } else { tags.push(tag); }
    const b = await getApi('getEvents', { tags: tags.join(',') });
    for (const e of b.events) {
        $('#filters').append($('<p>').text(e.title).click(() => selectTag(b)).css({
            borderColor: 'rgba(0,17,229,1)',
            backgroundColor: 'rgba(0,17,229,.2)'
        }));
    }
}

function clickFilters() {
    if (location.hash === '#filters') { location.hash = ''; } else { location.hash = 'filters'; }
}

getApi('getUserInfo').then(function(r) {
    if (r.error) { document.querySelector("#events > div.buttons").remove(); } else {
        $("#auth").empty().append($('<a href="profile">').text(`${r.firstName} ${r.secondName}`));
    }
});

getApi('getTags').then(function(b) {
    for (const e of b.tags) { $('#filters').append($('<p>').text(e.name).click(() => selectTag(e.id)).css({ borderColor: `rgba(${e.color},1)`, backgroundColor: `rgba(${e.color},.2)` })); }
});