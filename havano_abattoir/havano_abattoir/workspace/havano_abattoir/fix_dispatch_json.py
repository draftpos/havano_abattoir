import json
import os

filepath = "/Ubuntu-24.04/home/ashley/frappe-bench-v15/apps/havano_abattoir/havano_abattoir/havano_abattoir/doctype/dispatch/dispatch.json"

with open(filepath, 'r') as f:
    data = json.load(f)

# 1. Correct the field_order
correct_order = [
   "section_custom_layout", "custom_dispatch_layout", "date", "column_break_bmhd", "time", "column_break_vdwg",
   "sheet_no", "column_break_llvf", "customer_name", "column_break_ylyk", "product", "linked_receiving_section",
   "linked_receiving", "section_break_weights", "weight_label_1", "dispatch_items_1", "amended_from",
   "col_break_w1", "weight_label_2", "dispatch_items_2", "col_break_w2", "weight_label_3", "dispatch_items_3",
   "col_break_w3", "weight_label_4", "dispatch_items_4", "section_break_extra", "weight_label_7", "dispatch_items_7",
   "weight_group_5_label_copy", "weight_group_5_copy", "col_break_w7", "weight_label_8", "dispatch_items_8",
   "column_break_tjwo", "weight_group_7_label", "weight_group_7", "section_break_totals", "total_bags",
   "col_break_t1", "units_per_kg", "col_break_t2", "total_units", "col_break_t3", "total_kgs", "col_break_extra_total",
   "customer_rep", "col_break_t4", "foreperson", "col_break_t5", "security", "section_break_offal", "heads",
   "col_break_o1", "feet", "col_break_o2", "giz", "col_break_o3", "neck", "col_break_o4", "liver", "col_break_o5",
   "heart", "col_break_o6", "crop", "col_break_o7", "casings", "section_break_variance", "variance_heads",
   "col_break_v1", "variance_feet", "col_break_v2", "variance_giz", "col_break_v3", "variance_neck",
   "col_break_v4", "variance_liver", "col_break_v5", "variance_heart", "col_break_v6", "variance_crop",
   "col_break_v7", "variance_casings", "section_break_status", "dispatch_type", "column_break_zzel",
   "brining_kg_difference", "column_break_acgy"
]
data["field_order"] = correct_order

# 2. Add total_kgs to fields if missing
field_names = [f.get("fieldname") for f in data["fields"]]
if "total_kgs" not in field_names:
    data["fields"].append({
        "fieldname": "total_kgs",
        "fieldtype": "Float",
        "label": "Total KG",
        "precision": "3",
        "read_only": 1
    })

if "col_break_extra_total" not in field_names:
    data["fields"].append({
        "fieldname": "col_break_extra_total",
        "fieldtype": "Column Break"
    })

with open(filepath, 'w') as f:
    json.dump(data, f, indent=1)
