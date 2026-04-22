frappe.listview_settings['Receiving'] = {
    add_fields: ["customer_rep", "foreperson", "security"],
    formatters: {
        customer_rep: function(val, df, doc) {
            return doc.customer_rep_full_name || val;
        },
        foreperson: function(val, df, doc) {
            return doc.foreperson_full_name || val;
        },
        security: function(val, df, doc) {
            return doc.security_full_name || val;
        }
    },
    onload: function(listview) {
        // If the full_name fields are available, use them. 
        // Note: For this to work best, we might need Fetch From fields in the DocType.
    }
};
