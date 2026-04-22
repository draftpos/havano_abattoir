import frappe
from frappe.model.document import Document

class BlastFreezer(Document):
    def validate(self):
        # Prevent submission if status is not 'Ready for Packing'
        if self.docstatus == 1 and self.blast_freezer_status != "Ready for Packing":
            frappe.throw(frappe._("Please set Blast Freezer Status to 'Ready for Packing' before submitting."))
        
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

    def on_submit(self):
        # Automatically create Packaging record after blast freezer submission
        self.create_packaging()

    def create_packaging(self):
        pkg = frappe.new_doc("Packaging")
        pkg.date = self.date
        pkg.time = self.time
        pkg.sheet_no = self.sheet_no + "-P"
        pkg.customer_name = self.customer_name
        pkg.product = self.product
        pkg.linked_blast_freezer = self.name
        pkg.customer_rep = self.customer_rep
        pkg.foreperson = self.foreperson
        pkg.security = self.security
        
        pkg.insert(ignore_permissions=True)
        frappe.msgprint(frappe._("Packaging record {0} created.").format(pkg.name))
