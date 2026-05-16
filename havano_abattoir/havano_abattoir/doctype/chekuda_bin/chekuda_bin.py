import frappe
from frappe.model.document import Document

class ChekudaBin(Document):
    pass

@frappe.whitelist()
def get_chekuda_balance():
    """Returns the total balance of Offals and Birds in the Chekuda Bin"""
    
    # Calculate Offal Balance
    offal_balance = {}
    # Credits (Receives)
    receives = frappe.db.sql("""
        SELECT item.offal_type, SUM(item.weight_kgs) as total
        FROM `tabChekuda Bin Offal Item` item
        JOIN `tabChekuda Bin` parent ON item.parent = parent.name
        WHERE parent.docstatus = 1 AND parent.transaction_type = 'Receive'
        GROUP BY item.offal_type
    """, as_dict=1)
    
    # Debits (Sales)
    sales = frappe.db.sql("""
        SELECT item.offal_type, SUM(item.weight_kgs) as total
        FROM `tabChekuda Bin Offal Item` item
        JOIN `tabChekuda Bin` parent ON item.parent = parent.name
        WHERE parent.docstatus = 1 AND parent.transaction_type = 'Sale'
        GROUP BY item.offal_type
    """, as_dict=1)

    for r in receives:
        offal_balance[r.offal_type] = r.total
    for s in sales:
        offal_balance[s.offal_type] = offal_balance.get(s.offal_type, 0) - s.total

    # Calculate Bird Balance
    bird_balance = {}
    b_receives = frappe.db.sql("""
        SELECT item.classification, SUM(item.birds) as total
        FROM `tabChekuda Bin Item` item
        JOIN `tabChekuda Bin` parent ON item.parent = parent.name
        WHERE parent.docstatus = 1 AND parent.transaction_type = 'Receive'
        GROUP BY item.classification
    """, as_dict=1)
    
    b_sales = frappe.db.sql("""
        SELECT item.classification, SUM(item.birds) as total
        FROM `tabChekuda Bin Item` item
        JOIN `tabChekuda Bin` parent ON item.parent = parent.name
        WHERE parent.docstatus = 1 AND parent.transaction_type = 'Sale'
        GROUP BY item.classification
    """, as_dict=1)

    for r in b_receives:
        bird_balance[r.classification] = r.total
    for s in b_sales:
        bird_balance[s.classification] = bird_balance.get(s.classification, 0) - s.total

    return {
        "offals": offal_balance,
        "birds": bird_balance
    }
