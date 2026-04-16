import frappe
from frappe.model.document import Document

class Receiving(Document):
    def before_insert(self):
        if not self.sheet_no:
            # Get the highest sheet_no currently in the system
            last_sheet_no = frappe.db.get_value("Receiving", {}, "sheet_no", order_by="creation desc")
            if last_sheet_no:
                try:
                    # Try simple numeric increment first
                    self.sheet_no = str(int(last_sheet_no) + 1)
                except (ValueError, TypeError):
                    # If it's alphanumeric, try to extract the trailing digits
                    import re
                    match = re.search(r'(\d+)$', last_sheet_no)
                    if match:
                        num = int(match.group(1))
                        prefix = last_sheet_no[:match.start()]
                        # Format with same padding if necessary
                        self.sheet_no = f"{prefix}{num + 1}"
                    else:
                        self.sheet_no = "1001"
            else:
                self.sheet_no = "1001"

    def before_save(self):
        total_birds = 0
        total_kgs = 0.0
        for row in (self.receiving_items or []):
            total_birds += int(row.live_units or 0)
            total_kgs += float(row.kg or 0)
        self.total_live_birds = total_birds
        self.total_kgs = round(total_kgs, 3)
        self.average_live_weight = round(total_kgs / total_birds, 3) if total_birds > 0 else 0

    @frappe.whitelist()
    def sync_processing_status(self):
        # Sum total_units from all submitted Processings linked to this Receiving
        total_processed = frappe.db.get_value("Processing", 
            {"linked_receiving": self.name, "docstatus": 1}, 
            "sum(total_units)") or 0
        
        self.total_processed_units = total_processed
        total_birds = self.total_live_birds or 0

        if total_processed <= 0:
            self.processing_status = "Open"
        elif total_processed < total_birds:
            self.processing_status = "Partially Processed"
        else:
            self.processing_status = "Fully Processed"

        self.save(ignore_permissions=True)
        return self.processing_status

@frappe.whitelist()
def get_next_sheet_no():
    # Get the highest sheet_no currently in the system
    last_sheet_no = frappe.db.get_value("Receiving", {}, "sheet_no", order_by="creation desc")
    if last_sheet_no:
        try:
            return str(int(last_sheet_no) + 1)
        except (ValueError, TypeError):
            import re
            match = re.search(r'(\d+)$', last_sheet_no)
            if match:
                num = int(match.group(1))
                prefix = last_sheet_no[:match.start()]
                return f"{prefix}{num + 1}"
    return "1001"
