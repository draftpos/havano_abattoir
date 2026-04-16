import frappe
from frappe.model.document import Document

class Storage(Document):
    def validate(self):
        # Prevent submission if status is not 'Dispatched'
        if self.docstatus == 1 and self.storage_status != "Dispatched":
            frappe.throw(frappe._("Please set Storage Status to 'Dispatched' before submitting."))
        
        # Recalculate totals just in case (though fields are read-only in UI)
        self.calculate_totals()

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
