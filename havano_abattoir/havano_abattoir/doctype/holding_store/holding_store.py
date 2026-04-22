import frappe
from frappe.model.document import Document

class HoldingStore(Document):
    def validate(self):
        # Prevent submission if status is not 'Ready for Dispatch'
        if self.docstatus == 1 and self.holding_status == "On Hand":
            frappe.throw(frappe._("Please set Holding Status to 'Ready for Dispatch' before submitting."))
        
    def on_submit(self):
        # Automatically create Dispatch record after holding store submission if requested
        self.create_dispatch()

    def create_dispatch(self):
        dispatch = frappe.new_doc("Dispatch")
        dispatch.date = self.date
        dispatch.time = self.time
        dispatch.sheet_no = self.sheet_no.replace("-H", "-D")
        dispatch.customer_name = self.customer_name
        dispatch.product = self.product
        dispatch.linked_holding_store = self.name
        dispatch.total_sacks = self.total_sacks
        dispatch.total_packed_birds = self.total_packed_birds
        dispatch.total_kgs = self.total_kgs
        dispatch.customer_rep = self.customer_rep
        dispatch.foreperson = self.foreperson
        dispatch.security = self.security
        
        # Copy packing items to dispatch details table
        dispatch.set("dispatch_items", [])
        for row in self.packing_items:
            dispatch.append("dispatch_items", {
                "classification": row.classification,
                "no_of_sacks": row.no_of_sacks,
                "total_packed_birds": row.total_packed_birds
            })
        
        dispatch.insert(ignore_permissions=True)
        frappe.msgprint(frappe._("Dispatch record {0} created.").format(dispatch.name))
