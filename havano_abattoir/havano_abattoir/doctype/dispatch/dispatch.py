import frappe
from frappe.model.document import Document

class Dispatch(Document):
    def on_submit(self):
        if self.linked_holding_store:
            frappe.db.set_value("Holding Store", self.linked_holding_store, "holding_status", "Dispatched")
            frappe.msgprint(frappe._("Linked Holding Store <b>{0}</b> status updated to <b>Dispatched</b>.").format(self.linked_holding_store))
        
        self.handle_chekuda_payment()

    def on_cancel(self):
        if self.linked_holding_store:
            frappe.db.set_value("Holding Store", self.linked_holding_store, "holding_status", "Ready for Dispatch")

    def handle_chekuda_payment(self):
        if self.payment_method == "Cash/Bank":
            return

        cb = frappe.new_doc("Chekuda Bin")
        cb.customer_name = self.customer_name
        cb.date = self.date
        cb.dispatch_id = self.name
        cb.payment_method = self.payment_method

        has_payment = False

        # Handle Offals
        if "Offals" in self.payment_method:
            cb.offal_payment = 1
            for row in self.offal_returns:
                if row.weight_kgs > 0:
                    cb.append("offal_details", {
                        "offal_type": row.offal_type,
                        "weight_kgs": row.weight_kgs,
                        "total_packs": row.weight_kgs # Assuming 1kg per pack for receipts
                    })
            has_payment = True

        # Handle Birds
        if "Birds" in self.payment_method:
            cb.bird_payment = 1
            for row in self.dispatch_items:
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
