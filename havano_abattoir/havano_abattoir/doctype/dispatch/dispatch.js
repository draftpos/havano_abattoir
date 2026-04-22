frappe.ui.form.on('Dispatch', {
    refresh: function (frm) {
        if (frm.custom_ui_doc !== frm.doc.name) {
            frm.custom_ui_doc = frm.doc.name;
            $(frm.wrapper).find('#dispatch-custom-root').remove();
            frm.custom_ui_rendered = false;
            setTimeout(() => { render_custom_form(frm); }, 150);
        }

        // Enable "Link Title" view
        const link_fields = ['customer_name', 'linked_holding_store', 'customer_rep', 'foreperson', 'security'];
        link_fields.forEach(f => {
            frm.set_df_property(f, 'show_title_field_in_link', 1);
        });

        // Filter: Only show submitted Holding Store records that are not yet dispatched
        frm.set_query('linked_holding_store', function() {
            return {
                filters: [
                    ['Holding Store', 'docstatus', '=', 1],
                    ['Holding Store', 'holding_status', '!=', 'Dispatched']
                ]
            };
        });
    },

    on_submit: function(frm) {
        // Mark linked Holding Store as 'Dispatched'
        if (frm.doc.linked_holding_store) {
            frappe.db.set_value('Holding Store', frm.doc.linked_holding_store, 'holding_status', 'Dispatched')
                .then(() => {
                    frappe.msgprint({
                        title: __('Success'),
                        indicator: 'green',
                        message: __('Dispatch record submitted. Inventory has been marked as <b>Dispatched</b> and the workflow is now complete.')
                    });
                });
        }
    },

    linked_holding_store: function(frm) {
        if (frm.doc.linked_holding_store) {
            set_dispatch_baselines(frm, true);
        }
    }
});

function set_dispatch_baselines(frm, auto_fill = false) {
    if (!frm.doc.linked_holding_store) return;

    frappe.db.get_doc('Holding Store', frm.doc.linked_holding_store).then(hs => {
        ['customer_name', 'product', 'customer_rep', 'foreperson', 'security', 'total_sacks', 'total_packed_birds', 'total_kgs'].forEach(f => {
            if (hs[f] || auto_fill) frm.set_value(f, hs[f]);
        });

        if (hs.sheet_no) {
            frm.set_value('sheet_no', hs.sheet_no.replace('-H', '-DSP'));
        }

        // Copy packing items to dispatch items
        if (hs.packing_items) {
            frm.clear_table('dispatch_items');
            hs.packing_items.forEach(row => {
                let r = frm.add_child('dispatch_items');
                r.classification = row.classification;
                r.birds_per_sack = row.birds_per_sack;
                r.no_of_sacks = row.no_of_sacks;
                r.total_packed_birds = row.total_packed_birds;
            });
            frm.refresh_field('dispatch_items');
        }
    });
}

function render_custom_form(frm) {
    if (frm.custom_ui_rendered) return;
    frm.custom_ui_rendered = true;

    let html = `
    <style>
        #dispatch-custom-root {
            padding: 16px 20px 40px;
            background: #f1f5f9;
            box-sizing: border-box;
        }
        #dispatch-custom-root .frappe-control[data-fieldtype="Column Break"],
        #dispatch-custom-root .frappe-control[data-fieldtype="Section Break"] { display: none !important; }

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

    <div class="dc-card" style="border-left: 5px solid #6366f1;">
        <div class="dc-head"><div class="dc-title">🚚 Dispatch & Delivery Info</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-date"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-time"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-sheet_no"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-customer_name"></div>
                <div class="col-xs-12 col-md-6 mt-3" id="ph-product"></div>
                <div class="col-xs-12 col-md-6 mt-3" id="ph-linked_holding_store"></div>
            </div>
            <div class="row mt-4" style="padding-top:16px; border-top:1px dashed #e2e8f0;">
                <div class="col-md-4"><div id="ph-vehicle_no"></div></div>
                <div class="col-md-4"><div id="ph-driver_name"></div></div>
                <div class="col-md-4"><div id="ph-delivery_note_no"></div></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📋 Items for Dispatch</div></div>
        <div class="dc-body">
            <div id="ph-dispatch_items"></div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📊 Final Dispatch Totals & Staff</div></div>
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

    let $root = $('<div id="dispatch-custom-root">').html(html);
    let $page_head = $(frm.wrapper).find('.page-head');
    if ($page_head.length) { $root.insertAfter($page_head); } else { $(frm.wrapper).prepend($root); }

    let move_fields = [
        'date', 'time', 'sheet_no', 'customer_name', 'product',
        'linked_holding_store', 'vehicle_no', 'driver_name', 'delivery_note_no',
        'dispatch_items',
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
