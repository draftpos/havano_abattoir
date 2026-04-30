import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    return [
        {"label": _("Sheet No"), "fieldname": "sheet_no", "fieldtype": "Data", "width": 100},
        {"label": _("Customer"), "fieldname": "customer_name", "fieldtype": "Link", "options": "Customer", "width": 150},
        {"label": _("Date"), "fieldname": "date", "fieldtype": "Date", "width": 80},
        {"label": _("Product"), "fieldname": "product", "fieldtype": "Data", "width": 100},
        # Receiving
        {"label": _("Recv Live Birds"), "fieldname": "recv_live_birds", "fieldtype": "Int", "width": 120},
        {"label": _("Recv KG"), "fieldname": "recv_kg", "fieldtype": "Float", "width": 90},
        # Processing
        {"label": _("Proc Units"), "fieldname": "proc_units", "fieldtype": "Int", "width": 100},
        {"label": _("Proc KG"), "fieldname": "proc_kg", "fieldtype": "Float", "width": 90},
        {"label": _("Offal Returned KG"), "fieldname": "offal_kg", "fieldtype": "Float", "width": 120},
        # Brining
        {"label": _("Brining KG Diff"), "fieldname": "brining_diff", "fieldtype": "Float", "width": 120},
        # Blast Freezer
        {"label": _("BF Status"), "fieldname": "bf_status", "fieldtype": "Data", "width": 120},
        # Packaging
        {"label": _("Pkg Sacks"), "fieldname": "pkg_sacks", "fieldtype": "Int", "width": 90},
        {"label": _("Pkg Birds"), "fieldname": "pkg_birds", "fieldtype": "Int", "width": 90},
        # Holding
        {"label": _("Holding Status"), "fieldname": "holding_status", "fieldtype": "Data", "width": 120},
        # Dispatch
        {"label": _("Disp Sacks"), "fieldname": "disp_sacks", "fieldtype": "Int", "width": 90},
        {"label": _("Disp Birds"), "fieldname": "disp_birds", "fieldtype": "Int", "width": 90},
        {"label": _("Disp KG"), "fieldname": "disp_kg", "fieldtype": "Float", "width": 90},
        {"label": _("Vehicle"), "fieldname": "vehicle_no", "fieldtype": "Data", "width": 100},
        # Variances
        {"label": _("Bird Loss %"), "fieldname": "bird_loss_pct", "fieldtype": "Float", "width": 90},
        {"label": _("KG Loss %"), "fieldname": "kg_loss_pct", "fieldtype": "Float", "width": 90},
    ]

def get_data(filters):
    conditions = get_conditions(filters)
    
    query = """
    SELECT 
        r.sheet_no,
        r.customer_name,
        r.date,
        COALESCE(p.product, r.product, 'N/A') as product,
        r.total_live_birds as recv_live_birds,
        r.total_kgs as recv_kg,
        pr.total_units as proc_units,
        pr.total_kgs as proc_kg,
        COALESCE(SUM(pr_offal.weight_kgs), 0) as offal_kg,
        b.brining_kg_difference as brining_diff,
        bf.blast_freezer_status as bf_status,
        pkg.total_sacks as pkg_sacks,
        pkg.total_packed_birds as pkg_birds,
        hs.holding_status,
        d.total_sacks as disp_sacks,
        d.total_packed_birds as disp_birds,
        d.total_kgs as disp_kg,
        d.vehicle_no,
        ROUND(((r.total_live_birds - COALESCE(d.total_packed_birds, 0)) / NULLIF(r.total_live_birds, 0)) * 100, 2) as bird_loss_pct,
        ROUND(((r.total_kgs - COALESCE(d.total_kgs, 0)) / NULLIF(r.total_kgs, 0)) * 100, 2) as kg_loss_pct
    FROM `tabReceiving` r
    LEFT JOIN `tabProcessing` pr ON pr.linked_receiving = r.name AND pr.docstatus = 1
    LEFT JOIN `tabOffal Return` pr_offal ON pr_offal.parent = pr.name AND pr_offal.parentfield = 'offal_returns'
    LEFT JOIN `tabBrining` b ON b.sheet_no = r.sheet_no AND b.customer_name = r.customer_name AND b.docstatus = 1
    LEFT JOIN `tabBlast Freezer` bf ON bf.sheet_no = r.sheet_no AND bf.customer_name = r.customer_name AND bf.docstatus = 1
    LEFT JOIN `tabPackaging` pkg ON pkg.sheet_no = r.sheet_no AND pkg.customer_name = r.customer_name AND pkg.docstatus = 1
    LEFT JOIN `tabHolding Store` hs ON hs.sheet_no = r.sheet_no AND hs.customer_name = r.customer_name AND hs.docstatus = 1
    LEFT JOIN `tabDispatch` d ON d.linked_holding_store = hs.name AND d.docstatus = 1
    WHERE r.docstatus = 1 {conditions}
    GROUP BY r.name, r.sheet_no, r.customer_name, r.date, p.product, r.total_live_birds, r.total_kgs, 
             pr.total_units, pr.total_kgs, b.brining_kg_difference, bf.blast_freezer_status,
             pkg.total_sacks, pkg.total_packed_birds, hs.holding_status, d.total_sacks, d.total_packed_birds, 
             d.total_kgs, d.vehicle_no
    ORDER BY r.date DESC, r.sheet_no DESC
    """.format(conditions=conditions)
    
    return frappe.db.sql(query, filters, as_dict=1)

def get_conditions(filters):
    conditions = []
    if filters.get("from_date"):
        conditions.append("r.date >= %(from_date)s")
    if filters.get("to_date"):
        conditions.append("r.date <= %(to_date)s")
    if filters.get("customer"):
        conditions.append("r.customer_name = %(customer)s")
    if filters.get("sheet_no"):
        conditions.append("r.sheet_no like %(sheet_no)s")
    
    return " AND ".join(conditions) if conditions else ""

