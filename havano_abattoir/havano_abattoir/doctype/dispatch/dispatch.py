import frappe
from frappe.model.document import Document

class Dispatch(Document):
    def on_submit(self):
        if self.linked_holding_store:
            frappe.db.set_value("Holding Store", self.linked_holding_store, "holding_status", "Dispatched")
            frappe.msgprint(frappe._("Linked Holding Store <b>{0}</b> status updated to <b>Dispatched</b>.").format(self.linked_holding_store))

    def on_cancel(self):
        if self.linked_holding_store:
            frappe.db.set_value("Holding Store", self.linked_holding_store, "holding_status", "Ready for Dispatch")
