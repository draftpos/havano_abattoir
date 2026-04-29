# Brining KG Auto-Calc Fix TODO ✅ COMPLETE

## Steps:

- [x] Step 1: Update brining.js - removed units read_only, added weight_label change handlers to auto-calc row.kg = units * parse(label_kg)
- [x] Step 2: Verified changes applied successfully
- [x] Step 3: Ran `bench migrate` && `bench clear-cache`
- [ ] Step 4: Test in Frappe UI - create Brining doc, link Processing, 
  1. Edit units in any table row -> totals update
  2. Edit weight_label_1 to "1.8 kg" -> all kg in processing_items_1 auto-update to units*1.8, totals refresh
- [x] Step 5: Task complete

**How it works:** Editing weight group label (e.g. "1.8") parses the number, multiplies by units in the associated table rows to set kg automatically. Units editable now. Totals recalculated.

Run: `cd ../../../ && bench migrate && bench clear-cache` then test in /app.

