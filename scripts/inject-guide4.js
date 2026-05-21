const fs = require('fs');
const path = 'd:/Documents/GitHub/MyTeam/src/app/admin/members/page.client.tsx';
let src = fs.readFileSync(path, 'utf8');

// ── 1. Replace entire GuideStep interface + ALL_GUIDE_STEPS block ────────────
// This block was injected with LF line endings by inject-guide.js
const startMarker = '\ninterface GuideStep {';
const endMarker = '];\n\n\nfunction AdminMembersPageContent()';

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);
if (startIdx === -1) { console.error('startMarker not found'); process.exit(1); }
if (endIdx === -1) { console.error('endMarker not found'); process.exit(1); }

const newStepsBlock = `
interface GuideStep {
  id: string;
  title: string;
  description: string;
  adminOnly?: boolean;
  icon: string;
}

const ALL_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'welcome',
    title: 'Добре дошли в Наръчника',
    description: 'Това ръководство ще ви запознае с всички функции на страницата. Използвайте бутоните „Назад“ и „Напред“, за да преминавате между стъпките. В края ще намерите списък с всички теми, за да се върнете бързо към нужната.',
    icon: "<path d='M4 19.5A2.5 2.5 0 016.5 17H20'/><path d='M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z'/>",
  },
  {
    id: 'cards',
    title: 'Картичките на спортистите',
    description: 'Всяка картичка показва снимка, пълно име, рождена дата и статус на плащане. Зелено = платено. Жълто = предупреждение (текущият месец не е платен). Червено = просрочено (два или повече месеца неплатени). Търсете по горните полета и филтрирайте по отбор или група.',
    icon: "<rect x='1' y='4' width='22' height='16' rx='2' ry='2'/><line x1='1' y1='10' x2='23' y2='10'/><line x1='6' y1='15' x2='10' y2='15'/>",
  },
  {
    id: 'member-profile',
    title: 'Профил на спортиста',
    description: 'Кликнете върху картичка, за да отворите пълния профил. Там виждате история на плащанията, контакти и бутон за отбелязване на плащане. Можете да редактирате данните на спортиста или да добавите освобождаване от такса за конкретен месец.',
    icon: "<path d='M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2'/><circle cx='12' cy='7' r='4'/>",
  },
  {
    id: 'add-member',
    title: 'Добавяне на нов спортист',
    description: 'Зеленият бутон „Добави състезател“ отваря регистрационна форма. Попълнете: пълно име, снимка, дата на раждане, телефон и код на картата (от NFC карта). Кодът е 8-символно шестнадесетично число — четете го от самата карта или скенер.',
    icon: "<path d='M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'/><circle cx='8.5' cy='7' r='4'/><line x1='20' y1='8' x2='20' y2='14'/><line x1='23' y1='11' x2='17' y2='11'/>",
  },
  {
    id: 'reports',
    title: 'Отчети',
    description: 'Бутонът „Отчети“ показва финансова статистика за избран месец: брой платили, в предупреждение и просрочени. Подходящ за проверка преди родителска среща или при отчитане на приходите.',
    icon: "<line x1='18' y1='20' x2='18' y2='10'/><line x1='12' y1='20' x2='12' y2='4'/><line x1='6' y1='20' x2='6' y2='14'/>",
  },
  {
    id: 'schedule',
    title: 'График на тренировките',
    description: 'Бутонът „График“ отваря тренировъчния календар. Тук добавяте тренировъчни дни по седмица, задавате часове и терени, и планирате паузи или извънредни тренировки. Промените се отразяват на всички устройства на спортистите.',
    icon: "<rect x='3' y='4' width='18' height='18' rx='2' ry='2'/><line x1='16' y1='2' x2='16' y2='6'/><line x1='8' y1='2' x2='8' y2='6'/><line x1='3' y1='10' x2='21' y2='10'/>",
  },
  {
    id: 'attendance',
    title: 'Присъствия на тренировки',
    description: 'Бутонът „Присъствия“ е основният инструмент за отбелязване на присъствие. Изберете тренировъчна дата от календара, маркирайте кои спортисти са присъствали и добавете бележка ако е нужно. Историята се пази и е достъпна по месеци.',
    icon: "<polyline points='9 11 12 14 22 4'/><path d='M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11'/>",
  },
  {
    id: 'training-plans',
    title: 'Планове за тренировки',
    description: 'Бутонът „Планове за тренировки“ дава достъп до детайлни тренировъчни програми — структурирани по теми, периоди и групи. Можете да ги разглеждате и изпълнявате заедно с присъствията.',
    icon: "<path d='M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2'/><rect x='8' y='2' width='8' height='4' rx='1' ry='1'/><line x1='9' y1='12' x2='15' y2='12'/><line x1='9' y1='16' x2='13' y2='16'/>",
  },
  {
    id: 'notifications-settings',
    title: 'Настройки на известията',
    description: 'Бутонът „Известия“ управлява автоматичните напомняния за плащане. Задайте кой ден от месеца и в колко часа да се изпращат. Спортистите получават известие на телефона или компютъра си (ако са активирали известия от личната си страница).',
    icon: "<path d='M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.73 21a2 2 0 01-3.46 0'/>",
  },
  {
    id: 'monthly-fee',
    title: 'Месечна такса',
    description: 'Бутонът „Месечна такса“ задава размера на членската такса за клуба. Стойността се показва в профила на всеки спортист и в отчетите за плащания.',
    icon: "<line x1='12' y1='1' x2='12' y2='23'/><path d='M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6'/>",
  },
  {
    id: 'message',
    title: 'Изпращане на съобщение',
    description: 'Бутонът „Съобщение“ позволява да изпратите персонализирано push известие до избрани спортисти или цели групи. Съобщението се появява на телефона или компютъра им веднага.',
    icon: "<path d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'/>",
  },
  {
    id: 'import-sheets',
    title: 'Импорт от Google Sheets',
    description: 'Бутонът „Импорт“ позволява да заредите списък спортисти от Google Таблица. Посочете URL на таблицата и системата ще импортира имена, дати и телефони автоматично. Удобно при прехвърляне от стара система.',
    adminOnly: true,
    icon: "<path d='M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z'/><polyline points='14 2 14 8 20 8'/><line x1='16' y1='13' x2='8' y2='13'/><line x1='16' y1='17' x2='8' y2='17'/>",
  },
  {
    id: 'import-photos',
    title: 'Импорт на снимки от Drive',
    description: 'Бутонът „Снимки“ зарежда снимки от Google Drive масово. Снимките трябва да са именувани по код на картата или пълно ime — системата ги свързва автоматично с профилите.',
    adminOnly: true,
    icon: "<rect x='3' y='3' width='18' height='18' rx='2' ry='2'/><circle cx='8.5' cy='8.5' r='1.5'/><polyline points='21 15 16 10 5 21'/>",
  },
  {
    id: 'excel',
    title: 'Изтегляне на Excel',
    description: 'Бутонът „Excel“ изтегля актуален списък на всички активни спортисти като .xlsx файл, включващ имена, рождени дати, телефони и статуси на плащане. Удобно за архив или споделяне.',
    adminOnly: true,
    icon: "<path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'/><polyline points='7 10 12 15 17 10'/><line x1='12' y1='15' x2='12' y2='3'/>",
  },
  {
    id: 'inactive',
    title: 'Неактивни спортисти',
    description: 'Бутонът „Неактивни“ показва деактивираните спортисти. Можете да ги върнете в активния списък или да ги изтриете трайно от базата данни. Деактивирането не изтрива данните — просто ги скрива от основния списък.',
    adminOnly: true,
    icon: "<path d='M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'/><circle cx='8.5' cy='7' r='4'/><line x1='18' y1='8' x2='23' y2='13'/><line x1='23' y1='8' x2='18' y2='13'/>",
  },
  {
    id: 'groups',
    title: 'Настройки на групите',
    description: 'Бутонът „Групи“ управлява режима на тренировъчните групи: по набори (по годишнини) или по персонализирани групи с избран цвят. Тук се създават, редактират и изтриват групи.',
    adminOnly: true,
    icon: "<path d='M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 00-3-3.87'/><path d='M16 3.13a4 4 0 010 7.75'/>",
  },
  {
    id: 'coaches',
    title: 'Управление на треньори',
    description: 'Бутонът „Треньори“ задава кои спортисти са достъпни за всеки треньорски акаунт. Всеки треньор вижда само назначената му група. Тук добавяте и управлявате треньорски групи.',
    adminOnly: true,
    icon: "<circle cx='12' cy='8' r='6'/><path d='M15.477 12.89L17 22l-5-3-5 3 1.523-9.11'/>",
  },
  {
    id: 'links',
    title: 'Изтегляне на линкове',
    description: 'Бутонът „Линкове“ изтегля текстов файл с персоналните URL адреси на всички спортисти — за разпечатване или изпращане. Всеки линк отваря личната страница на спортиста (за NFC карта или QR код).',
    adminOnly: true,
    icon: "<path d='M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3'/><line x1='8' y1='12' x2='16' y2='12'/>",
  },
  {
    id: 'payment-workflow',
    title: 'Метод на плащане',
    description: 'Бутонът „Метод плащане“ избира как се изчисляват месечните такси: по календарен месец (стандартно) или Rolling 30 дни — 30 дни след датата на последното плащане. Промяната засяга статусите на всички спортисти.',
    adminOnly: true,
    icon: "<polyline points='23 4 23 10 17 10'/><polyline points='1 20 1 14 7 14'/><path d='M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15'/>",
  },
  {
    id: 'billing',
    title: 'Абонамент и такси',
    description: 'Бутонът „Такси“ показва информация за абонамента на клуба в платформата и историята на фактурирането.',
    adminOnly: true,
    icon: "<path d='M20 12V22H4V12'/><path d='M22 7H2v5h20V7z'/><path d='M12 22V7'/><path d='M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z'/><path d='M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z'/>",
  },
  {
    id: 'edit-team',
    title: 'Редактиране на отбора',
    description: 'Бутонът „Редактирай“ отваря настройките на отбора: промяна на логото, името, вида спорт и конфигурация. Тук се управляват и основните данни на клуба като стандартни времена за тренировки и терени.',
    adminOnly: true,
    icon: "<circle cx='12' cy='12' r='3'/><path d='M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z'/>",
  },
];

`;

// endIdx points to the ']' of '];\n\n\nfunction AdminMembersPageContent()'
// We want to cut up to (and including) '];\n\n' — 4 chars: ] ; \n \n
const cutEnd = endIdx + '];\n\n'.length;
src = src.slice(0, startIdx) + newStepsBlock + src.slice(cutEnd);
console.log('GuideStep block replaced');

// ── 2. Replace step-body in modal to render icon ─────────────────────────────
// Modal was injected with CRLF by inject-guide3.js
const stepBodyAnchor = '<div className="amp-guide-step-body">\r\n              <div className="amp-guide-step-num" aria-hidden="true">{guideStep + 1}</div>\r\n              <div>\r\n                <h3 className="amp-guide-step-title">{guideSteps[guideStep]?.title}</h3>\r\n                <p className="amp-guide-step-desc">{guideSteps[guideStep]?.description}</p>\r\n              </div>\r\n            </div>';

const stepBodyReplace = `<div className="amp-guide-step-body">\r\n              <div\r\n                className="amp-guide-step-icon-wrap"\r\n                aria-hidden="true"\r\n                dangerouslySetInnerHTML={{\r\n                  __html: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (guideSteps[guideStep]?.icon ?? '') + '</svg>'\r\n                }}\r\n              />\r\n              <div>\r\n                <h3 className="amp-guide-step-title">{guideSteps[guideStep]?.title}</h3>\r\n                <p className="amp-guide-step-desc">{guideSteps[guideStep]?.description}</p>\r\n              </div>\r\n            </div>`;

if (!src.includes(stepBodyAnchor)) { console.error('stepBody anchor not found'); process.exit(1); }
src = src.replace(stepBodyAnchor, stepBodyReplace);
console.log('step-body icon added');

fs.writeFileSync(path, src, 'utf8');
console.log('OK - icons injected');
