frappe.ui.form.on('Storage', {
    refresh: function (frm) {
        if (frm.custom_ui_doc !== frm.doc.name) {
            frm.custom_ui_doc = frm.doc.name;
            $(frm.wrapper).find('#storage-custom-root').remove();
            frm.custom_ui_rendered = false;
            setTimeout(() => { render_custom_form(frm); }, 150);
        }

        // Enable "Link Title" view for standard fetching/naming
        const link_fields = ['customer_name', 'linked_processing', 'linked_brining', 'customer_rep', 'foreperson', 'security'];
        link_fields.forEach(f => {
            frm.set_df_property(f, 'show_title_field_in_link', 1);
        });

        // Add indicator for status
        let color = frm.doc.storage_status === 'Dispatched' ? 'green' : 'orange';
        frm.page.set_indicator(frm.doc.storage_status, color);

        // Explicitly disable submit button if status is 'On Hand'
        if (frm.doc.docstatus === 0 && frm.doc.storage_status === 'On Hand') {
            frm.page.set_primary_action(__('Save Status'), () => frm.save());
        }

        // Ensure origin baselines (names/metrics) are updated if necessary
        if (!frm.is_new() && (frm.doc.linked_processing || frm.doc.linked_brining)) {
            set_origin_baselines(frm);
        }
    },

    storage_status: function(frm) {
        let color = frm.doc.storage_status === 'Dispatched' ? 'green' : 'orange';
        frm.page.set_indicator(frm.doc.storage_status, color);
    },

    linked_processing: function(frm) {
        if (frm.doc.linked_processing) {
            set_origin_baselines(frm, true);
        }
    },

    linked_brining: function(frm) {
        if (frm.doc.linked_brining) {
            set_origin_baselines(frm, true);
        }
    }
});

function set_origin_baselines(frm, auto_fill = false) {
    let source_doctype = frm.doc.linked_brining ? 'Brining' : 'Processing';
    let source_name = frm.doc.linked_brining || frm.doc.linked_processing;
    
    if (!source_name) return;

    frappe.db.get_doc(source_doctype, source_name).then(src => {
        // Sync Customer and Personnel (IDs will be auto-resolved to Names by "Native Fetching")
        if (!frm.doc.customer_name || auto_fill) {
            frm.set_value('customer_name', src.customer_name);
        }

        ['customer_rep', 'foreperson', 'security'].forEach(f => {
            if (!frm.doc[f] || auto_fill) {
                frm.set_value(f, src[f]);
            }
        });

        // Sync Offal counts and Variances
        let fields = [
            'heads', 'feet', 'giz', 'neck', 'liver', 'heart', 'crop', 'casings',
            'variance_heads', 'variance_feet', 'variance_giz', 'variance_neck', 
            'variance_liver', 'variance_heart', 'variance_crop', 'variance_casings'
        ];
        
        fields.forEach(f => {
            if (src[f] !== undefined && (frm.doc[f] === 0 || frm.doc[f] === null || auto_fill)) {
                frm.set_value(f, src[f]);
            }
        });

        if (auto_fill) frm.refresh_fields(fields);
    });
}

function render_custom_form(frm) {
    if (frm.custom_ui_rendered) return;
    frm.custom_ui_rendered = true;

    let html = `
    <style>
        #storage-custom-root {
            padding: 16px 20px 40px;
            background: #f1f5f9;
            box-sizing: border-box;
        }
        #storage-custom-root .frappe-control[data-fieldtype="Column Break"],
        #storage-custom-root .frappe-control[data-fieldtype="Section Break"] { display: none !important; }

        .dc-card {
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            margin-bottom: 16px;
            overflow: visible;
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
        .dc-head.collapsible { cursor: pointer; }
        .dc-head.collapsible:hover { background: #f1f5f9; }
        .dc-title { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px; }
        .dc-body { padding: 16px 20px; }
        .chevron { transition: transform 0.25s; fill: #64748b; flex-shrink: 0; }
        .is-collapsed .chevron { transform: rotate(-90deg); }

        /* Compact Table Layout */
        .wg-box .grid-heading-row .row, .wg-box .data-row.row {
            display: flex !important; align-items: center !important; flex-wrap: nowrap !important;
        }
        .wg-box .grid-heading-row .row > [class*="col-"], .wg-box .data-row.row > [class*="col-"] {
            flex: 1 1 0 !important; width: auto !important; min-width: 0 !important; float: none !important;
        }
        /* Shrink Checkbox Column to give more space to KG */
        .wg-box .grid-heading-row .row > :first-child, 
        .wg-box .data-row.row > :first-child {
            flex: 0 0 32px !important;
            max-width: 32px !important;
        }

        .wg-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 992px) { .wg-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 576px) { .wg-grid { grid-template-columns: 1fr; } }

        .wg-box {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px;
            background: #fafafa;
        }
        .wg-box-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #475569;
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px dashed #cbd5e1;
        }
        .wg-box .frappe-control label.control-label { font-size: 11px !important; color: #64748b !important; }
    </style>

    <div class="dc-card" style="border-left: 5px solid #0891b2;">
        <div class="dc-head"><div class="dc-title">🔘 Batch Status</div></div>
        <div class="dc-body">
            <div id="ph-storage_status"></div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">❄️ Storage Information</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-date"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-time"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-sheet_no"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-customer_name"></div>
                <div class="col-xs-12 col-md-12 mt-3" id="ph-product"></div>
                <div class="col-xs-12 col-md-4 mt-3" id="ph-linked_processing" style="display:none;"></div>
                <div class="col-xs-12 col-md-4 mt-3" id="ph-linked_brining" style="display:none;"></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📦 Inventory Batches (1 – 4)</div></div>
        <div class="dc-body">
            <div class="wg-grid">
                <div class="wg-box"><div class="wg-box-title">Group 1</div><div id="ph-weight_label_1"></div><div id="ph-processing_items_1"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 2</div><div id="ph-weight_label_2"></div><div id="ph-processing_items_2"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 3</div><div id="ph-weight_label_3"></div><div id="ph-processing_items_3"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 4</div><div id="ph-weight_label_4"></div><div id="ph-processing_items_4"></div></div>
            </div>
        </div>
    </div>

    <div class="dc-card is-collapsed" id="extra-card">
        <div class="dc-head collapsible" onclick="toggle_extra()">
            <div class="dc-title">📦 Additional Inventory Batches (5 – 8)</div>
            <svg class="chevron" width="18" height="18" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
        </div>
        <div class="dc-body" id="extra-card-body" style="display:none;">
            <div class="wg-grid">
                <div class="wg-box"><div class="wg-box-title">Group 5</div><div id="ph-weight_label_7"></div><div id="ph-processing_items_7"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 6</div><div id="ph-weight_label_8"></div><div id="ph-processing_items_8"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 7</div><div id="ph-weight_group_7_label"></div><div id="ph-weight_group_7"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 8</div><div id="ph-weight_group_5_label_copy"></div><div id="ph-weight_group_5_copy"></div></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">🥩 Offals & Variances (from Origin)</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-xs-6 col-md-3" id="ph-heads"></div><div class="col-xs-6 col-md-3" id="ph-variance_heads"></div>
                <div class="col-xs-6 col-md-3" id="ph-feet"></div><div class="col-xs-6 col-md-3" id="ph-variance_feet"></div>
            </div>
            <div class="row mt-3">
                <div class="col-xs-6 col-md-3" id="ph-giz"></div><div class="col-xs-6 col-md-3" id="ph-variance_giz"></div>
                <div class="col-xs-6 col-md-3" id="ph-neck"></div><div class="col-xs-6 col-md-3" id="ph-variance_neck"></div>
            </div>
            <div class="row mt-3">
                <div class="col-xs-6 col-md-3" id="ph-liver"></div><div class="col-xs-6 col-md-3" id="ph-variance_liver"></div>
                <div class="col-xs-6 col-md-3" id="ph-heart"></div><div class="col-xs-6 col-md-3" id="ph-variance_heart"></div>
            </div>
            <div class="row mt-3">
                <div class="col-xs-6 col-md-3" id="ph-crop"></div><div class="col-xs-6 col-md-3" id="ph-variance_crop"></div>
                <div class="col-xs-6 col-md-3" id="ph-casings"></div><div class="col-xs-6 col-md-3" id="ph-variance_casings"></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📊 Final Totals & Staff</div></div>
        <div class="dc-body">
            <div class="row" style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #e2e8f0;">
                <div class="col-xs-6 col-md-3" id="ph-total_bags"></div><div class="col-xs-6 col-md-3" id="ph-total_units"></div>
                <div class="col-xs-6 col-md-3" id="ph-units_per_kg"></div><div class="col-xs-6 col-md-3" id="ph-total_kgs"></div>
            </div>
            <div class="row">
                <div class="col-md-4"><div id="ph-customer_rep"></div></div>
                <div class="col-md-4"><div id="ph-foreperson"></div></div>
                <div class="col-md-4"><div id="ph-security"></div></div>
            </div>
        </div>
    </div>`;

    let $root = $('<div id="storage-custom-root">').html(html);
    let $page_head = $(frm.wrapper).find('.page-head');
    if ($page_head.length) { $root.insertAfter($page_head); } else { $(frm.wrapper).prepend($root); }

    window.toggle_extra = function () {
        $('#extra-card').toggleClass('is-collapsed');
        $('#extra-card-body').slideToggle(200);
    };

    let move_fields = [
        'date','time','sheet_no','customer_name','product','storage_status',
        'linked_processing','linked_brining',
        'heads','feet','giz','neck','liver','heart','crop','casings',
        'variance_heads','variance_feet','variance_giz','variance_neck','variance_liver','variance_heart','variance_crop','variance_casings',
        'total_bags','total_units','units_per_kg','total_kgs',
        'customer_rep','foreperson','security',
        'weight_label_1','processing_items_1','weight_label_2','processing_items_2',
        'weight_label_3','processing_items_3','weight_label_4','processing_items_4',
        'weight_label_7','processing_items_7','weight_label_8','processing_items_8',
        'weight_group_7_label','weight_group_7','weight_group_5_label_copy','weight_group_5_copy'
    ];

    move_fields.forEach(fname => {
        let f = frm.fields_dict[fname];
        if (f && f.wrapper) {
            $root.find('#ph-' + fname).append(f.wrapper);
            $(f.wrapper).css('margin-bottom','0');
        }
    });

    $(frm.wrapper).find('.page-form').hide();
    $(frm.wrapper).find('.form-layout').hide();
    $(frm.wrapper).find('.layout-main-section-wrapper').hide();
    $(frm.wrapper).find('.layout-side-section').hide();
}
