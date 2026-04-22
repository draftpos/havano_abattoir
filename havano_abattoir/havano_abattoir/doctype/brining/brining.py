import frappe
from frappe.model.document import Document

class Brining(Document):
    def validate(self):
        self.calculate_totals()
        if self.linked_processing:
            # Fetch weight from original Processing document to prevent exceeding unexpectedly?
            # Actually, brining increases weight. So there is no hard cap on weight checking.
            # But we can calculate the difference.
            self.calculate_brining_difference()

    def on_submit(self):
        # Push to Blast Freezer automatically after brining
        from havano_abattoir.havano_abattoir.doctype.processing.processing import push_to_blast_freezer
        push_to_blast_freezer(self, "linked_brining")

    def calculate_totals(self):
        total_units = 0
        total_kgs = 0.0
        total_bags = 0
        tables = [
            'processing_items_1', 'processing_items_2', 'processing_items_3', 'processing_items_4',
            'processing_items_7', 'processing_items_8', 'weight_group_7', 'weight_group_5_copy'
        ]
        for tbl in tables:
            for row in (self.get(tbl) or []):
                u = int(row.units or 0)
                k = float(row.kg or 0)
                if u > 0:
                    total_units += u
                    total_kgs += k
                    total_bags += 1
        self.total_units = total_units
        self.total_bags = total_bags
        self.total_kgs = total_kgs
        self.units_per_kg = round(total_units / total_kgs, 3) if total_kgs > 0 else 0

    def calculate_brining_difference(self):
        try:
            if frappe.db.exists("Processing", self.linked_processing):
                orig = frappe.get_doc("Processing", self.linked_processing)
                tables = [
                    'processing_items_1', 'processing_items_2', 'processing_items_3', 'processing_items_4',
                    'processing_items_7', 'processing_items_8', 'weight_group_7', 'weight_group_5_copy'
                ]
                orig_kgs = sum(float(row.kg or 0) for tbl in tables for row in (orig.get(tbl) or []))
                new_kgs  = sum(float(row.kg or 0) for tbl in tables for row in (self.get(tbl) or []))
                self.fresh_weight = round(orig_kgs, 3)
                self.brining_kg_difference = round(new_kgs - orig_kgs, 3)
        except Exception:
            pass
