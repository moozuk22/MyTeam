const fs = require('fs');
const path = 'd:/Documents/GitHub/MyTeam/src/app/admin/members/page.client.tsx';
let src = fs.readFileSync(path, 'utf8');

// Insert screenshot image slot between </h2> and <div className="amp-guide-step-body">
// Modal was injected with CRLF by inject-guide3.js so anchor uses \r\n
const imgAnchor = '</h2>\r\n            <div className="amp-guide-step-body">';

const imgInsert = '</h2>\r\n            <div\r\n              key={guideSteps[guideStep]?.id}\r\n              className="amp-guide-step-img-wrap"\r\n              style={{ display: \'none\' }}\r\n            >\r\n              <img\r\n                src={\'/guide/\' + (guideSteps[guideStep]?.id ?? \'\') + \'.png\'}\r\n                alt=""\r\n                className="amp-guide-step-img"\r\n                onLoad={(e) => { if (e.currentTarget.parentElement) (e.currentTarget.parentElement as HTMLElement).style.display = \'flex\'; }}\r\n                onError={(e) => { if (e.currentTarget.parentElement) (e.currentTarget.parentElement as HTMLElement).style.display = \'none\'; }}\r\n              />\r\n            </div>\r\n            <div className="amp-guide-step-body">';

if (!src.includes(imgAnchor)) { console.error('image anchor not found'); process.exit(1); }
src = src.replace(imgAnchor, imgInsert);
console.log('image slot inserted');

fs.writeFileSync(path, src, 'utf8');
console.log('OK - image slot injected');
