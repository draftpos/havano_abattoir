import frappe
from frappe.model.document import Document

class Packaging(Document):
    def validate(self):
        self.calculate_totals()

    def calculate_totals(self):
        total_sacks = 0
        total_birds = 0
        for row in (self.packing_items or []):
            if row.no_of_sacks and row.birds_per_sack:
                row.total_packed_birds = row.no_of_sacks * row.birds_per_sack
            
            total_sacks += (row.no_of_sacks or 0)
            total_birds += (row.total_packed_birds or 0)
            
        self.total_sacks = total_sacks
        self.total_packed_birds = total_birds

    def on_submit(self):
        self.create_holding_store()

    def create_holding_store(self):
        hs = frappe.new_doc("Holding Store")
        hs.date = self.date
        hs.time = self.time
        hs.sheet_no = self.sheet_no.replace("-P", "-H")
        hs.customer_name = self.customer_name
        hs.product = self.product
        hs.linked_packaging = self.name
        hs.total_sacks = self.total_sacks
        hs.total_packed_birds = self.total_packed_birds
        
        # Copy totals from BF via Packaging link
        hs.total_kgs = frappe.db.get_value("Blast Freezer", self.linked_blast_freezer, "total_kgs")
        
        hs.customer_rep = self.customer_rep
        hs.foreperson = self.foreperson
        hs.security = self.security
        
        # Copy packing items to holding store inventory table
        hs.set("packing_items", [])
        for row in self.packing_items:
            hs.append("packing_items", {
                "classification": row.classification,
                "total_available_birds": row.total_available_birds,
                "birds_per_sack": row.birds_per_sack,
                "no_of_sacks": row.no_of_sacks,
                "total_packed_birds": row.total_packed_birds
            })
        
        hs.insert(ignore_permissions=True)
        frappe.msgprint(frappe._("Birds moved to <b>Holding Store</b>: {0}").format(hs.name))
