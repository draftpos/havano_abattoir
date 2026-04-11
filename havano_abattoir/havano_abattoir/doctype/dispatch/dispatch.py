import frappe
from frappe.model.document import Document

class Dispatch(Document):
    def validate(self):
        self.calculate_totals()
        if self.linked_receiving:
            # Fetch both birds and weight from Receiving
            receiving_data = frappe.db.get_value("Receiving", self.linked_receiving, ["total_live_birds", "total_kgs"], as_dict=1)
            
            if receiving_data:
                # 1. Units Validation
                if (self.total_units or 0) > (receiving_data.total_live_birds or 0):
                    frappe.throw(frappe._("Total Units (<b>{0}</b>) cannot exceed Birds in Linked Receiving (<b>{1}</b>)").format(
                        self.total_units, receiving_data.total_live_birds))
                
                # 2. KG Validation
                if (self.total_kgs or 0) > (receiving_data.total_kgs or 0):
                    frappe.throw(frappe._("Total KG (<b>{0}</b>) cannot exceed Weight in Linked Receiving (<b>{1} kg</b>)").format(
                        self.total_kgs, receiving_data.total_kgs))

    def before_save(self):
        self.calculate_variance()
        if self.dispatch_type == "Brining" and self.linked_receiving:
            self.calculate_brining_difference()

    def on_submit(self):
        self.update_receiving_status(is_submit=True)

    def on_cancel(self):
        self.update_receiving_status(is_submit=False)

    def update_receiving_status(self, is_submit=False):
        if not self.linked_receiving:
            return

        # Fetch the baseline totals for the record.
        total_birds = frappe.db.get_value("Receiving", self.linked_receiving, "total_live_birds") or 0
        total_dispatched = frappe.db.get_value("Dispatch", 
            {"linked_receiving": self.linked_receiving, "docstatus": 1}, 
            "sum(total_units)") or 0

        # Always mark as Fully Dispatched if user submits, otherwise keep as Open/Partial
        new_status = "Open"
        if is_submit:
            new_status = "Fully Dispatched"
        elif total_dispatched > 0:
            new_status = "Partially Dispatched"
        
        frappe.db.set_value("Receiving", self.linked_receiving, {
            "total_dispatched_units": total_dispatched,
            "dispatch_status": new_status
        }, update_modified=True)

    def calculate_totals(self):
        total_units = 0
        total_kgs = 0.0
        total_bags = 0
        tables = [
            'dispatch_items_1', 'dispatch_items_2', 'dispatch_items_3', 'dispatch_items_4',
            'dispatch_items_7', 'dispatch_items_8', 'weight_group_7', 'weight_group_5_copy'
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

    def calculate_variance(self):
        # Variance = Actual returns minus Expected Baseline (from Receiving)
        if not self.linked_receiving:
             return

        expected_birds = frappe.db.get_value("Receiving", self.linked_receiving, "total_live_birds") or 0
        
        self.variance_heads   = int(self.heads or 0) - expected_birds
        self.variance_feet    = int(self.feet or 0) - (expected_birds * 2)
        self.variance_giz     = int(self.giz or 0) - expected_birds
        self.variance_neck    = int(self.neck or 0) - expected_birds
        self.variance_liver   = int(self.liver or 0) - expected_birds
        self.variance_heart   = int(self.heart or 0) - expected_birds
        self.variance_crop    = int(self.crop or 0) - expected_birds
        self.variance_casings = int(self.casings or 0) - expected_birds

    def calculate_brining_difference(self):
        try:
            # Bug fix: check if linked_receiving is actually a Dispatch record 
            # (In some cases it might be used to link dispatches for brining)
            if frappe.db.exists("Dispatch", self.linked_receiving):
                orig = frappe.get_doc("Dispatch", self.linked_receiving)
                tables = [
                    'dispatch_items_1', 'dispatch_items_2', 'dispatch_items_3', 'dispatch_items_4',
                    'dispatch_items_7', 'dispatch_items_8', 'weight_group_7', 'weight_group_5_copy'
                ]
                orig_kgs = sum(float(row.kg or 0) for tbl in tables for row in (orig.get(tbl) or []))
                new_kgs  = sum(float(row.kg or 0) for tbl in tables for row in (self.get(tbl) or []))
                self.brining_kg_difference = round(new_kgs - orig_kgs, 3)
        except Exception:
            pass
