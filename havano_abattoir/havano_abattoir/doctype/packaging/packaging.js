frappe.ui.form.on('Packaging', {
    refresh: function (frm) {
        if (frm.custom_ui_doc !== frm.doc.name) {
            frm.custom_ui_doc = frm.doc.name;
            $(frm.wrapper).find('#packaging-custom-root').remove();
            frm.custom_ui_rendered = false;
            setTimeout(() => { render_custom_form(frm); }, 150);
        }

        // Enable "Link Title" view
        const link_fields = ['customer_name', 'linked_blast_freezer', 'customer_rep', 'foreperson', 'security'];
        link_fields.forEach(f => {
            frm.set_df_property(f, 'show_title_field_in_link', 1);
        });

        // Fetch packing baselines if linked
        if (frm.doc.linked_blast_freezer && (!frm.doc.packing_items || frm.doc.packing_items.length === 0)) {
            set_packing_baselines(frm);
        }

        // Filter: Only show submitted Blast Freezer records that are not yet packed
        frm.set_query('linked_blast_freezer', function() {
            return {
                filters: [
                    ['Blast Freezer', 'docstatus', '=', 1],
                    ['Blast Freezer', 'blast_freezer_status', '!=', 'Packed']
                ]
            };
        });
    },

    on_submit: function(frm) {
        // Mark linked Blast Freezer as 'Packed'
        if (frm.doc.linked_blast_freezer) {
            frappe.db.set_value('Blast Freezer', frm.doc.linked_blast_freezer, 'blast_freezer_status', 'Packed')
                .then(() => {
                    frappe.msgprint({
                        title: __('Success'),
                        indicator: 'green',
                        message: __('Packaging record submitted. Linked Blast Freezer has been marked as <b>Packed</b> and moved to the <b>Holding Store</b>.')
                    });
                });
        }
    },

    linked_blast_freezer: function(frm) {
        if (frm.doc.linked_blast_freezer) {
            set_packing_baselines(frm);
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

function set_packing_baselines(frm) {
    frappe.db.get_doc('Havano Abattoir Settings', 'Havano Abattoir Settings').then(settings => {
        let options = settings.birds_per_sack_options || [];
        let default_option = options.find(o => o.is_default);
        let birds_per_sack = default_option ? default_option.birds_per_sack : (options.length > 0 ? options[0].birds_per_sack : 20);
        
        let options_str = options.map(o => o.birds_per_sack).join('\n');
        if (!options_str) options_str = "20";
        frappe.meta.get_docfield('Packing Item', 'birds_per_sack_dropdown', frm.doc.name).options = options_str;
        
        frappe.db.get_doc('Blast Freezer', frm.doc.linked_blast_freezer).then(bf => {
            // Auto-fetch details
            ['customer_name', 'product', 'customer_rep', 'foreperson', 'security'].forEach(f => {
                if (bf[f]) frm.set_value(f, bf[f]);
            });
            
            if (bf.sheet_no) {
                // In packaging, we probably change -BF to -P or keep -BF? 
                // Let's replace -BF with -P (Packaging) or just copy it directly.
                // Looking at standard conventions, maybe it's just copied or changed. I'll replace -BF with -P or just replace it.
                // Wait, maybe we just use -PKG or -P. I'll replace -BF with -PKG.
                frm.set_value('sheet_no', bf.sheet_no.replace('-BF', '-PKG'));
            }

            frm.clear_table('packing_items');
            
            let classification_map = {};
            let tables = [
                'processing_items_1', 'processing_items_2', 'processing_items_3', 'processing_items_4',
                'processing_items_7', 'processing_items_8', 'weight_group_7', 'weight_group_5_copy'
            ];
            
            tables.forEach(table_name => {
                let label_field = table_name.replace('processing_items_', 'weight_label_');
                if (table_name === 'weight_group_7') label_field = 'weight_group_7_label';
                if (table_name === 'weight_group_5_copy') label_field = 'weight_group_5_label_copy';
                
                let label = bf[label_field] || "Standard";
                let units = 0;
                (bf[table_name] || []).forEach(row => {
                    units += (row.units || 0);
                });
                
                if (units > 0) {
                    if (!classification_map[label]) classification_map[label] = 0;
                    classification_map[label] += units;
                }
            });
            
            Object.keys(classification_map).forEach(label => {
                let r = frm.add_child('packing_items');
                r.classification = label;
                r.total_available_birds = classification_map[label];
                r.birds_per_sack_dropdown = birds_per_sack.toString();
                r.birds_per_sack = birds_per_sack;
                r.no_of_sacks = Math.ceil(classification_map[label] / birds_per_sack);
                r.total_packed_birds = classification_map[label];
            });
            
            frm.refresh_field('packing_items');
            calculate_totals(frm);
        });
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
        #packaging-custom-root {
            padding: 16px 20px 40px;
            background: #f1f5f9;
            box-sizing: border-box;
        }
        #packaging-custom-root .frappe-control[data-fieldtype="Column Break"],
        #packaging-custom-root .frappe-control[data-fieldtype="Section Break"] { display: none !important; }

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

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📦 Packaging Information</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-date"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-time"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-sheet_no"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-customer_name"></div>
                <div class="col-xs-12 col-md-6 mt-3" id="ph-product"></div>
                <div class="col-xs-12 col-md-6 mt-3" id="ph-linked_blast_freezer"></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">⚙️ Packing Process (By Classification)</div></div>
        <div class="dc-body">
            <div id="ph-packing_items"></div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📊 Packaging Totals & Staff</div></div>
        <div class="dc-body">
            <div class="row" style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #e2e8f0;">
                <div class="col-xs-6 col-md-6" id="ph-total_sacks"></div>
                <div class="col-xs-6 col-md-6" id="ph-total_packed_birds"></div>
            </div>
            <div class="row">
                <div class="col-md-4"><div id="ph-customer_rep"></div></div>
                <div class="col-md-4"><div id="ph-foreperson"></div></div>
                <div class="col-md-4"><div id="ph-security"></div></div>
            </div>
        </div>
    </div>`;

    let $root = $('<div id="packaging-custom-root">').html(html);
    let $page_head = $(frm.wrapper).find('.page-head');
    if ($page_head.length) { $root.insertAfter($page_head); } else { $(frm.wrapper).prepend($root); }

    let move_fields = [
        'date', 'time', 'sheet_no', 'customer_name', 'product',
        'linked_blast_freezer', 'packing_items',
        'total_sacks', 'total_packed_birds',
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
