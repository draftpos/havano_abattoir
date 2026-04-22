import frappe
from frappe.model.document import Document

class Processing(Document):
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

    def on_submit(self):
        self.update_receiving_status(is_submit=True)
        # Push to Blast Freezer if user selected Unbrining
        if self.workflow_next_step == "Unbrining (Send to Storage)":
            push_to_blast_freezer(self, "linked_processing")

    def on_cancel(self):
        self.update_receiving_status(is_submit=False)

    def update_receiving_status(self, is_submit=False):
        if not self.linked_receiving:
            return

        # Fetch the baseline totals for the record.
        total_birds = frappe.db.get_value("Receiving", self.linked_receiving, "total_live_birds") or 0
        total_processed = frappe.db.get_value("Processing", 
            {"linked_receiving": self.linked_receiving, "docstatus": 1}, 
            "sum(total_units)") or 0

        # Always mark as Fully Processed if user submits, otherwise keep as Open/Partial
        new_status = "Open"
        if is_submit:
            new_status = "Fully Processed"
        elif total_processed > 0:
            new_status = "Partially Processed"
        
        frappe.db.set_value("Receiving", self.linked_receiving, {
            "total_processed_units": total_processed,
            "processing_status": new_status
        }, update_modified=True)

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

def push_to_blast_freezer(doc, link_field):
    bf = frappe.new_doc("Blast Freezer")
    bf.update({
        "customer_name": doc.customer_name,
        "product": doc.product,
        "sheet_no": doc.sheet_no,
        "customer_rep": doc.customer_rep,
        "foreperson": doc.foreperson,
        "security": doc.security,
        "total_bags": doc.total_bags,
        "total_units": doc.total_units,
        "total_kgs": doc.total_kgs,
        "units_per_kg": doc.units_per_kg,
        link_field: doc.name,
        "blast_freezer_status": "Freezing"
    })
    
    # Copy Offal Returns table
    bf.set("offal_returns", [])
    for row in (doc.get("offal_returns") or []):
        bf.append("offal_returns", {
            "offal_type": row.offal_type,
            "weight_kgs": row.weight_kgs
        })
    
    tables = [
        'processing_items_1', 'processing_items_2', 'processing_items_3', 'processing_items_4',
        'processing_items_7', 'processing_items_8', 'weight_group_7', 'weight_group_5_copy'
    ]
    
    for label_f in ['weight_label_1', 'weight_label_2', 'weight_label_3', 'weight_label_4', 'weight_label_7', 'weight_label_8', 'weight_group_7_label', 'weight_group_5_label_copy']:
        bf.set(label_f, doc.get(label_f))

    for tbl in tables:
        bf.set(tbl, [])
        for row in (doc.get(tbl) or []):
            bf.append(tbl, {
                "units": row.units,
                "kg": row.kg
            })
    
    bf.insert(ignore_permissions=True)
    frappe.msgprint(frappe._("Batch has been posted to <b>Blast Freezer</b> (Freezing)."))
