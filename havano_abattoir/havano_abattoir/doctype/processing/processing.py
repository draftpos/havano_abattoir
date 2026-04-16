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

    def before_save(self):
        self.calculate_variance()

    def on_submit(self):
        self.update_receiving_status(is_submit=True)
        # Push to Storage if user selected Unbrining
        if self.workflow_next_step == "Unbrining (Send to Storage)":
            push_to_storage(self, "linked_processing")

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

    def calculate_variance(self):
        # Variance = Actual returns minus Expected Baseline (from Receiving)
        if not self.linked_receiving:
             return

        expected_birds = frappe.db.get_value("Receiving", self.linked_receiving, "total_live_birds") or 0
        
        # Variance = Expected - Actual (remaining to be found)
        self.variance_heads   = expected_birds - int(self.heads or 0)
        self.variance_feet    = (expected_birds * 2) - int(self.feet or 0)
        self.variance_giz     = expected_birds - int(self.giz or 0)
        self.variance_neck    = expected_birds - int(self.neck or 0)
        self.variance_liver   = expected_birds - int(self.liver or 0)
        self.variance_heart   = expected_birds - int(self.heart or 0)
        self.variance_crop    = expected_birds - int(self.crop or 0)
        self.variance_casings = expected_birds - int(self.casings or 0)

def push_to_storage(doc, link_field):
    storage = frappe.new_doc("Storage")
    storage.update({
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
        "storage_status": "On Hand"
    })
    
    # Copy Offals and Variances
    offal_fields = ['heads', 'feet', 'giz', 'neck', 'liver', 'heart', 'crop', 'casings']
    variance_fields = ['variance_heads', 'variance_feet', 'variance_giz', 'variance_neck', 'variance_liver', 'variance_heart', 'variance_crop', 'variance_casings']
    
    for f in offal_fields + variance_fields:
        storage.set(f, doc.get(f))
    
    tables = [
        'processing_items_1', 'processing_items_2', 'processing_items_3', 'processing_items_4',
        'processing_items_7', 'processing_items_8', 'weight_group_7', 'weight_group_5_copy'
    ]
    
    for label_f in ['weight_label_1', 'weight_label_2', 'weight_label_3', 'weight_label_4', 'weight_label_7', 'weight_label_8', 'weight_group_7_label', 'weight_group_5_label_copy']:
        storage.set(label_f, doc.get(label_f))

    for tbl in tables:
        storage.set(tbl, [])
        for row in (doc.get(tbl) or []):
            storage.append(tbl, {
                "units": row.units,
                "kg": row.kg
            })
    
    storage.insert(ignore_permissions=True)
    frappe.msgprint(frappe._("Finalized batch has been posted to <b>Storage</b> (On Hand)."))
