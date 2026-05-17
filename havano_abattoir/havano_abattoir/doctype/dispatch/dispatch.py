import frappe
from frappe.model.document import Document

class Dispatch(Document):
    def onload(self):
        # Force reload the doctype schema from JSON when the form is opened
        try:
            frappe.reload_doc("havano_abattoir", "doctype", "dispatch")
            frappe.reload_doc("havano_abattoir", "doctype", "packing_item")
            frappe.reload_doc("havano_abattoir", "doctype", "dispatch_item")
            frappe.reload_doc("havano_abattoir", "doctype", "holding_store")
            # Clear any property setters that might be hiding the field
            frappe.db.sql("""DELETE FROM `tabProperty Setter` WHERE doc_type='Dispatch' AND field_name='payment_method'""")
            frappe.clear_cache(doctype='Dispatch')
            frappe.clear_cache(doctype='Holding Store')
        except Exception as e:
            pass
            
    def on_submit(self):
        if self.linked_holding_store:
            hs = frappe.get_doc("Holding Store", self.linked_holding_store)
            is_fully_dispatched = True
            
            for d_item in self.get("dispatch_items", []):
                for hs_item in hs.get("packing_items", []):
                    if d_item.classification == hs_item.classification and d_item.birds_per_sack == hs_item.birds_per_sack:
                        new_sacks = (hs_item.dispatched_sacks or 0) + (d_item.no_of_sacks or 0)
                        new_birds = (hs_item.dispatched_birds or 0) + (d_item.total_packed_birds or 0)
                        frappe.db.set_value("Packing Item", hs_item.name, {
                            "dispatched_sacks": new_sacks,
                            "dispatched_birds": new_birds
                        })
                        hs_item.dispatched_sacks = new_sacks
                        hs_item.dispatched_birds = new_birds
                        break

            for hs_item in hs.get("packing_items", []):
                if (hs_item.total_packed_birds or 0) > (hs_item.dispatched_birds or 0):
                    is_fully_dispatched = False
                    break
            
            status = "Dispatched" if is_fully_dispatched else "Partially Dispatched"
            frappe.db.set_value("Holding Store", self.linked_holding_store, "holding_status", status)
            frappe.msgprint(frappe._("Linked Holding Store <b>{0}</b> status updated to <b>{1}</b>.").format(self.linked_holding_store, status))
        
        self.handle_chekuda_payment()

    def on_cancel(self):
        if self.linked_holding_store:
            hs = frappe.get_doc("Holding Store", self.linked_holding_store)
            is_completely_empty = True
            
            for d_item in self.get("dispatch_items", []):
                for hs_item in hs.get("packing_items", []):
                    if d_item.classification == hs_item.classification and d_item.birds_per_sack == hs_item.birds_per_sack:
                        new_sacks = max(0, (hs_item.dispatched_sacks or 0) - (d_item.no_of_sacks or 0))
                        new_birds = max(0, (hs_item.dispatched_birds or 0) - (d_item.total_packed_birds or 0))
                        frappe.db.set_value("Packing Item", hs_item.name, {
                            "dispatched_sacks": new_sacks,
                            "dispatched_birds": new_birds
                        })
                        hs_item.dispatched_sacks = new_sacks
                        hs_item.dispatched_birds = new_birds
                        break

            for hs_item in hs.get("packing_items", []):
                if (hs_item.dispatched_birds or 0) > 0:
                    is_completely_empty = False
                    break
                    
            status = "Ready for Dispatch" if is_completely_empty else "Partially Dispatched"
            frappe.db.set_value("Holding Store", self.linked_holding_store, "holding_status", status)

    def handle_chekuda_payment(self):
        payment_method = self.get("payment_method")
        
        if not payment_method:
            frappe.throw(frappe._("Payment Method is required. If you cannot see this field, please run 'bench migrate' and clear your cache."))
            
        if payment_method == "Cash/Bank":
            return

        cb = frappe.new_doc("Chekuda Bin")
        cb.customer_name = self.customer_name
        cb.date = self.date
        cb.dispatch_id = self.name
        cb.payment_method = payment_method

        has_payment = False

        # Handle Offals
        if "Offals" in payment_method:
            cb.offal_payment = 1
            for row in self.get("offal_returns", []):
                if row.weight_kgs > 0:
                    cb.append("offal_details", {
                        "offal_type": row.offal_type,
                        "weight_kgs": row.weight_kgs,
                        "total_packs": row.weight_kgs # Assuming 1kg per pack for receipts
                    })
            has_payment = True

        # Handle Birds
        if "Birds" in payment_method:
            cb.bird_payment = 1
            for row in self.get("dispatch_items", []):
                if row.paid_birds > 0:
                    cb.append("bird_details", {
                        "classification": row.classification,
                        "birds": row.paid_birds
                    })
            has_payment = True

        if has_payment:
            cb.insert()
            cb.submit()
            frappe.msgprint(frappe._("Chekuda Bin entry <b>{0}</b> created for payment.").format(cb.name))
