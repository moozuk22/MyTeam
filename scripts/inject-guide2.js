const fs = require('fs');
const path = 'd:/Documents/GitHub/MyTeam/src/app/admin/members/page.client.tsx';
let src = fs.readFileSync(path, 'utf8');

// ── 1. Add state after importPhotosOpen ──────────────────────────────────────
const stateAnchor = '  const [importPhotosOpen, setImportPhotosOpen] = useState(false);';
const stateInsert = `  const [importPhotosOpen, setImportPhotosOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);`;
if (!src.includes(stateAnchor)) { console.error('state anchor not found'); process.exit(1); }
src = src.replace(stateAnchor, stateInsert);
console.log('state inserted');

// ── 2. Add useMemo after bulkCoachGroupVisibleMembers ────────────────────────
const memoAnchor = '  }, [bulkCoachGroupAllMembers, bulkCoachGroupSearchTerm]);';
const memoInsert = `  }, [bulkCoachGroupAllMembers, bulkCoachGroupSearchTerm]);

  const guideSteps = useMemo(
    () => ALL_GUIDE_STEPS.filter((s) => !s.adminOnly || isAdmin),
    [isAdmin],
  );`;
if (!src.includes(memoAnchor)) { console.error('memo anchor not found'); process.exit(1); }
src = src.replace(memoAnchor, memoInsert);
console.log('useMemo inserted');

fs.writeFileSync(path, src, 'utf8');
console.log('OK - state + useMemo injected');
