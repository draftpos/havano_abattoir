frappe.query_reports["Receiving to Dispatch Flow"] = {
	"filters": [
		{
			"fieldname":"from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1,
			"width": "80"
		},
		{
			"fieldname":"to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today(),
			"reqd": 1,
			"width": "80"
		},
		{
			"fieldname": "customer",
			"label": __("Customer"),
			"fieldtype": "Link",
			"options": "Customer",
			"width": "150"
		},
		{
			"fieldname": "sheet_no",
			"label": __("Sheet No"),
			"fieldtype": "Data",
			"width": "100"
		}
	],
	"formatter": function(value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		
		// Highlight losses >5%
		if (column.fieldname == "bird_loss_pct" || column.fieldname == "kg_loss_pct") {
			if (value > 5) {
				value = value + '%';
				$(column.row).css({"background-color": "#ffef9c"});
			} else if (value > 10) {
				value = '<span style="color:red; font-weight:bold">' + value + '%</span>';
			}
		}
		return value;
	}
};

