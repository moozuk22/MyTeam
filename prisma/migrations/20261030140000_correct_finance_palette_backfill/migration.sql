-- The original backfill included the text contrast color as an extra palette entry.
-- Normalize that unsupported value without changing any valid administrator selections.
UPDATE club_finance_categories SET color='#A6A6A6' WHERE color='#141414';
