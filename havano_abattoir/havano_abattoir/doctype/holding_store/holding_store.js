frappe.ui.form.on('Holding Store', {
    refresh: function (frm) {
        if (frm.custom_ui_doc !== frm.doc.name) {
            frm.custom_ui_doc = frm.doc.name;
            $(frm.wrapper).find('#holding-store-custom-root').remove();
            frm.custom_ui_rendered = false;
            setTimeout(() => { render_custom_form(frm); }, 150);
        }

        // Enable "Link Title" view
        const link_fields = ['customer_name', 'linked_packaging', 'customer_rep', 'foreperson', 'security'];
        link_fields.forEach(f => {
            frm.set_df_property(f, 'show_title_field_in_link', 1);
        });

        // Add indicator for status
        let color = frm.doc.holding_status === 'Dispatched' ? 'green' : 'orange';
        frm.page.set_indicator(frm.doc.holding_status, color);

        // Fetch packing baselines if linked
        if (frm.doc.linked_packaging && (!frm.doc.packing_items || frm.doc.packing_items.length === 0)) {
            set_packing_baselines(frm);
        }

        // Filter: Only show submitted Packaging records
        frm.set_query('linked_packaging', function() {
            return {
                filters: [
                    ['Packaging', 'docstatus', '=', 1]
                ]
            };
        });
    },

    on_submit: function(frm) {
        frappe.msgprint({
            title: __('Success'),
            indicator: 'green',
            message: __('Holding Store record submitted. Inventory is now <b>Ready for Dispatch</b>.')
        });
    },

    holding_status: function(frm) {
        let color = frm.doc.holding_status === 'Dispatched' ? 'green' : 'orange';
        frm.page.set_indicator(frm.doc.holding_status, color);
    },

    linked_packaging: function(frm) {
        if (frm.doc.linked_packaging) {
            set_packing_baselines(frm, true);
        }
    }
});

frappe.ui.form.on('Packing Item', {
    no_of_sacks: function(frm, cdt, cdn) {
        calculate_packing_row(frm, cdt, cdn);
    },
    birds_per_sack_dropdown: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        let bps = parseInt(row.birds_per_sack_dropdown) || 0;
        frappe.model.set_value(cdt, cdn, 'birds_per_sack', bps);
        
        if (bps > 0 && row.total_available_birds) {
            frappe.model.set_value(cdt, cdn, 'no_of_sacks', Math.ceil(row.total_available_birds / bps));
        }
        
        calculate_packing_row(frm, cdt, cdn);
    },
    birds_per_sack: function(frm, cdt, cdn) {
        calculate_packing_row(frm, cdt, cdn);
    }
});

function calculate_packing_row(frm, cdt, cdn) {
    let row = frappe.get_doc(cdt, cdn);
    if (row.no_of_sacks && row.birds_per_sack) {
        let total = row.no_of_sacks * row.birds_per_sack;
        if (row.total_available_birds && total > row.total_available_birds) {
            total = row.total_available_birds;
        }
        frappe.model.set_value(cdt, cdn, 'total_packed_birds', total);
    }
    calculate_totals(frm);
}

function set_packing_baselines(frm, auto_fill = false) {
    if (!frm.doc.linked_packaging) return;

    frappe.db.get_doc('Packaging', frm.doc.linked_packaging).then(pkg => {
        // Auto-fetch details
        ['customer_name', 'product', 'customer_rep', 'foreperson', 'security', 'total_sacks', 'total_packed_birds'].forEach(f => {
            if (pkg[f] || auto_fill) frm.set_value(f, pkg[f]);
        });
        
        if (pkg.sheet_no) {
            frm.set_value('sheet_no', pkg.sheet_no.replace('-PKG', '-H'));
        }

        // Copy packing items from Packaging
        if (pkg.packing_items) {
            frm.clear_table('packing_items');
            pkg.packing_items.forEach(row => {
                let r = frm.add_child('packing_items');
                r.classification = row.classification;
                r.no_of_sacks = row.no_of_sacks;
                r.birds_per_sack = row.birds_per_sack;
                r.total_packed_birds = row.total_packed_birds;
            });
            frm.refresh_field('packing_items');
        }
        
        calculate_totals(frm);
    });
}

function calculate_totals(frm) {
    let total_sacks = 0, total_birds = 0;
    (frm.doc.packing_items || []).forEach(row => {
        total_sacks += (row.no_of_sacks || 0);
        total_birds += (row.total_packed_birds || 0);
    });
    frm.set_value('total_sacks', total_sacks);
    frm.set_value('total_packed_birds', total_birds);
}

function render_custom_form(frm) {
    if (frm.custom_ui_rendered) return;
    frm.custom_ui_rendered = true;

    let html = `
    <style>
        #holding-store-custom-root {
            padding: 16px 20px 40px;
            background: #f1f5f9;
            box-sizing: border-box;
        }
        #holding-store-custom-root .frappe-control[data-fieldtype="Column Break"],
        #holding-store-custom-root .frappe-control[data-fieldtype="Section Break"] { display: none !important; }

        .dc-card {
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            margin-bottom: 16px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .dc-head {
            border-radius: 8px 8px 0 0;
            padding: 12px 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .dc-title { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px; }
        .dc-body { padding: 16px 20px; }
    </style>

    <div class="dc-card" style="border-left: 5px solid #10b981;">
        <div class="dc-head"><div class="dc-title">🚚 Holding & Dispatch Status</div></div>
        <div class="dc-body">
            <div id="ph-holding_status"></div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">🏠 Holding Information</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-date"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-time"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-sheet_no"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-customer_name"></div>
                <div class="col-xs-12 col-md-6 mt-3" id="ph-product"></div>
                <div class="col-xs-12 col-md-6 mt-3" id="ph-linked_packaging"></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📦 Packing Details (Repacking into Sacks)</div></div>
        <div class="dc-body">
            <div id="ph-packing_items"></div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📊 Final Totals & Staff</div></div>
        <div class="dc-body">
            <div class="row" style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #e2e8f0;">
                <div class="col-xs-6 col-md-4" id="ph-total_sacks"></div>
                <div class="col-xs-6 col-md-4" id="ph-total_packed_birds"></div>
                <div class="col-xs-6 col-md-4" id="ph-total_kgs"></div>
            </div>
            <div class="row">
                <div class="col-md-4"><div id="ph-customer_rep"></div></div>
                <div class="col-md-4"><div id="ph-foreperson"></div></div>
                <div class="col-md-4"><div id="ph-security"></div></div>
            </div>
        </div>
    </div>`;

    let $root = $('<div id="holding-store-custom-root">').html(html);
    let $page_head = $(frm.wrapper).find('.page-head');
    if ($page_head.length) { $root.insertAfter($page_head); } else { $(frm.wrapper).prepend($root); }

    let move_fields = [
        'date', 'time', 'sheet_no', 'customer_name', 'product', 'holding_status',
        'linked_packaging', 'packing_items',
        'total_sacks', 'total_packed_birds', 'total_kgs',
        'customer_rep', 'foreperson', 'security'
    ];

    move_fields.forEach(fname => {
        let f = frm.fields_dict[fname];
        if (f && f.wrapper) {
            $root.find('#ph-' + fname).append(f.wrapper);
            $(f.wrapper).css('margin-bottom', '0');
        }
    });

    $(frm.wrapper).find('.page-form').hide();
    $(frm.wrapper).find('.form-layout').hide();
    $(frm.wrapper).find('.layout-main-section-wrapper').hide();
    $(frm.wrapper).find('.layout-side-section').hide();
}
