frappe.ui.form.on('Dispatch', {

    onload: function (frm) {
        if (frm.is_new()) {
            frm.set_value('date', frappe.datetime.get_today());
            frm.set_value('time', frappe.datetime.now_time());
        }
    },

    refresh: function (frm) {
        if (frm.is_new()) {
            frm.set_value('time', frappe.datetime.now_time());
        }

        // Only rebuild the layout when switching to a different document.
        if (frm.custom_ui_doc !== frm.doc.name) {
            frm.custom_ui_doc = frm.doc.name;
            $(frm.wrapper).find('#dispatch-custom-root').remove();
            frm.custom_ui_rendered = false;
            setTimeout(() => { render_custom_form(frm); }, 150);
        }

        if (frm.doc.dispatch_type) {
            let color = frm.doc.dispatch_type === 'Brining' ? 'orange' : 'green';
            frm.page.set_indicator(frm.doc.dispatch_type, color);
        }

        if (frm.doc.dispatch_type === 'Unbrining' && frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Create Brining Dispatch'), function () {
                create_brining_dispatch(frm);
            }, __('Actions'));
        }

        // Filter: Hide fully dispatched Receiving records
        frm.set_query('linked_receiving', function() {
            return {
                filters: [
                    ['Receiving', 'dispatch_status', '!=', 'Fully Dispatched']
                ]
            };
        });

        // Load baselines for existing records
        if (frm.doc.linked_receiving) {
            set_receiving_baselines(frm);
        }
    },

    linked_receiving: function(frm) {
        if (frm.doc.linked_receiving) {
            set_receiving_baselines(frm, true);
        }
    },

    before_submit: function (frm) {
        if (!frm.doc.dispatch_type) {
            frappe.validated = false;
            show_dispatch_type_dialog(frm, true); // Added 'true' to trigger auto-submit
        }
    },

    validate: function (frm) {
        if (frm.doc.linked_receiving) {
            // Units Validation
            if (frm.doc.total_units > (frm.expected_birds || 0)) {
                frappe.msgprint({
                    title: __('Validation Error'),
                    message: __('Total Units (<b>{0}</b>) cannot exceed Birds in Linked Receiving (<b>{1}</b>).', 
                        [frm.doc.total_units, frm.expected_birds]),
                    indicator: 'red'
                });
                frappe.validated = false;
            }
            
            // KG Validation
            if (frm.doc.total_kgs > (frm.expected_kgs || 0)) {
                frappe.msgprint({
                    title: __('Weight Error'),
                    message: __('Total weight (<b>{0} kg</b>) cannot exceed Weight in Linked Receiving (<b>{1} kg</b>).', 
                        [frm.doc.total_kgs, frm.expected_kgs]),
                    indicator: 'red'
                });
                frappe.validated = false;
            }
        }
    }
});

// Real-time calculation triggers for all Dispatch Items
frappe.ui.form.on('Dispatch Item', {
    units: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        let table_name = row.parentfield;
        
        // Map parentfield to its corresponding multiplier (Label) field
        let multiplier_field = table_name.replace('dispatch_items_', 'weight_label_');
        if (table_name === 'weight_group_7') multiplier_field = 'weight_group_7_label';
        if (table_name === 'weight_group_5_copy') multiplier_field = 'weight_group_5_label_copy';

        // Get multiplier from the corresponding "Weight Group(kg)" label field
        let label_val = frm.doc[multiplier_field] || "";
        let multiplier = parseFloat(label_val.toString().replace(',', '.')) || 0;
        
        // Fallback to batch average weight if label is empty or not a number
        if (multiplier === 0 && frm.rcv_avg_weight) {
            multiplier = frm.rcv_avg_weight;
        }

        if (row.units && multiplier > 0) {
            frappe.model.set_value(cdt, cdn, 'kg', parseFloat((row.units * multiplier).toFixed(3)));
        }
        calculate_totals(frm);
    },
    kg: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        // Support Comma Input: Convert "15,5" to "15.5" string for Frappe to parse
        if (typeof row.kg === 'string' && row.kg.includes(',')) {
            let val = parseFloat(row.kg.replace(',', '.'));
            if (!isNaN(val)) frappe.model.set_value(cdt, cdn, 'kg', val);
        }
        calculate_totals(frm);
    }
});

// Add/Remove triggers for all tables
['dispatch_items_1','dispatch_items_2','dispatch_items_3','dispatch_items_4','dispatch_items_7','dispatch_items_8','weight_group_7','weight_group_5_copy'].forEach(table_name => {
    frappe.ui.form.on(table_name, {
        [`${table_name}_add`]: function(frm) { calculate_totals(frm); },
        [`${table_name}_remove`]: function(frm) { calculate_totals(frm); }
    });
});

// Real-time triggers for Offal parts to update Variances
['heads','feet','giz','neck','liver','heart','crop','casings'].forEach(field => {
    frappe.ui.form.on('Dispatch', {
        [field]: function(frm) { 
            calculate_totals(frm); 
        }
    });
});

function set_receiving_baselines(frm, auto_fill = false) {
    frappe.db.get_value('Receiving', frm.doc.linked_receiving, ['total_live_birds', 'total_kgs', 'average_live_weight'], (r) => {
        frm.expected_birds = r.total_live_birds || 0;
        frm.expected_kgs = r.total_kgs || 0;
        frm.rcv_avg_weight = r.average_live_weight || 0;
        
        if (auto_fill) {
            frappe.db.get_doc('Receiving', frm.doc.linked_receiving).then(rcv => {
                frm.set_value('sheet_no', rcv.sheet_no);
                frm.set_value('customer_name', rcv.customer_name);
                frm.set_value('customer_rep', rcv.customer_rep);
                frm.set_value('foreperson', rcv.foreperson);
                frm.set_value('security', rcv.security);
                if (!frm.doc.product) frm.set_value('product', 'Whole Birds');
                calculate_totals(frm);
            });
        }
    });
}

function show_dispatch_type_dialog(frm, auto_submit = false) {
    let d = new frappe.ui.Dialog({
        title: '🐔 Select Dispatch Type',
        fields: [{
            fieldtype: 'HTML',
            options: `<div style="padding:10px 0;font-size:14px;color:#555;">Choose how this batch is being dispatched:</div>`
        }],
        primary_action_label: '✅ Unbrining (Direct Dispatch)',
        primary_action: function () { 
            frm.set_value('dispatch_type', 'Unbrining'); 
            d.hide(); 
            if (auto_submit) {
                frm.savesubmit();
            } else {
                frm.save();
            }
        },
        secondary_action_label: '🧊 Brining (Add Weight)',
        secondary_action: function () { 
            frm.set_value('dispatch_type', 'Brining'); 
            d.hide(); 
            if (auto_submit) {
                frm.savesubmit();
            } else {
                frm.save();
            }
        }
    });
    d.show();
}

function get_all_dispatch_rows(frm) {
    let tables = [
        'dispatch_items_1','dispatch_items_2','dispatch_items_3','dispatch_items_4',
        'dispatch_items_7','dispatch_items_8','weight_group_7','weight_group_5_copy'
    ];
    let all = [];
    tables.forEach(tbl => { if (frm.doc[tbl]) all = all.concat(frm.doc[tbl]); });
    return all;
}

function calculate_totals(frm) {
    let total_units = 0, total_kgs = 0, total_bags = 0;
    let tables = ['dispatch_items_1','dispatch_items_2','dispatch_items_3','dispatch_items_4','dispatch_items_7','dispatch_items_8','weight_group_7','weight_group_5_copy'];
    
    tables.forEach(table_name => {
        let sub_u = 0, sub_k = 0;
        (frm.doc[table_name] || []).forEach(row => {
            let units = parseInt(row.units || 0);
            let kg = row.kg || 0;
            if (typeof kg === 'string') kg = parseFloat(kg.replace(',', '.'));
            
            sub_u += units;
            sub_k += parseFloat(kg || 0);
            
            total_units += units;
            total_kgs += parseFloat(kg || 0);
            if (units > 0) total_bags++;
        });

        // Update Sub-total in UI
        let $st = $(frm.wrapper).find(`#subtotal-${table_name}`);
        if ($st.length) {
            $st.html(`
                <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:#64748b; padding-top:8px; border-top:1px dashed #cbd5e1; margin-top:8px;">
                    <span>TOTAL:</span>
                    <span>${sub_u} Units | ${sub_k.toFixed(2)} KG</span>
                </div>
            `);
        }
    });

    frm.set_value('total_units', total_units);
    frm.set_value('total_bags', total_bags);
    frm.set_value('total_kgs', total_kgs);
    frm.set_value('units_per_kg', total_kgs > 0 ? parseFloat((total_units / total_kgs).toFixed(3)) : 0);
    
    // Variance Baseline: Always use the original received bird count
    let base = frm.expected_birds || 0;
    calculate_variance(frm, base);
}

function calculate_variance(frm, base) {
    ['heads','feet','giz','neck','liver','heart','crop','casings'].forEach(part => {
        let actual = parseInt(frm.doc[part] || 0);
        let expected = (part === 'feet') ? base * 2 : base;
        frm.set_value('variance_' + part, actual - expected);
    });
}

function create_brining_dispatch(frm) {
    frappe.confirm('Create a new <b>Brining</b> Dispatch linked to this document?', function () {
        frappe.new_doc('Dispatch', {
            customer_name: frm.doc.customer_name, product: frm.doc.product,
            linked_receiving: frm.doc.linked_receiving,
            dispatch_type: 'Brining', sheet_no: frm.doc.sheet_no + '-B'
        });
    });
}

// =============================================================
// FULL CUSTOM FORM LAYOUT
// Native Frappe fields AND child tables are MOVED into our 
// custom layout so they retain ALL built-in functionality.
// =============================================================

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
            overflow: visible;
            box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .dc-head {
            padding: 12px 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 8px 8px 0 0;
        }
        .dc-head.collapsible { cursor: pointer; }
        .dc-head.collapsible:hover { background: #f1f5f9; }
        .dc-title { font-size: 14px; font-weight: 600; color: #1e293b; margin: 0; }
        .dc-body { padding: 16px 20px; }
        .chevron { transition: transform 0.25s; fill: #64748b; flex-shrink: 0; }
        .is-collapsed .chevron { transform: rotate(-90deg); }

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

        .offal-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 12px; letter-spacing: 0.5px; }

        /* ── Compact child table inside weight group boxes ─────────── */
        /* Force flex layout on grid rows so columns share width properly */
        .wg-box .grid-heading-row .row,
        .wg-box .data-row.row {
            display: flex !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
        }

        /* All Bootstrap col-* inside grid rows go flex equally */
        .wg-box .grid-heading-row .row > [class*="col-"],
        .wg-box .data-row.row > [class*="col-"] {
            flex: 1 1 0 !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            float: none !important;
            overflow: hidden !important;
        }

        /* Static system columns (checkbox, row-index, delete) stay fixed and small */
        .wg-box .grid-static-col,
        .wg-box .col.row-check,
        .wg-box .col.row-index {
            flex: 0 0 24px !important;
            width: 24px !important;
            max-width: 24px !important;
            min-width: 24px !important;
            padding: 0 2px !important;
        }

        /* Smaller text and padding inside compact grid */
        .wg-box .grid-heading-row { font-size: 11px !important; }
        .wg-box .grid-body { font-size: 12px !important; }
        .wg-box .grid-body .data-row .col,
        .wg-box .grid-heading-row .col { padding: 3px 4px !important; }
        .wg-box .grid-body input.input-with-feedback,
        .wg-box .grid-body .form-control { font-size: 12px !important; padding: 2px 4px !important; height: 26px !important; }
        .wg-box .grid-footer .btn { padding: 2px 6px !important; font-size: 11px !important; }

        /* Proportional space for Units and KG */
        .wg-box [data-fieldname="units"], 
        .wg-box [data-fieldname="kg"] { 
            flex: 1.5 1 0 !important; 
        }
    </style>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📝 Dispatch Information</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-date"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-time"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-sheet_no"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-customer_name"></div>
                <div class="col-xs-12 col-md-4 mt-3" id="ph-product"></div>
                <div class="col-xs-12 col-md-4 mt-3" id="ph-dispatch_type"></div>
                <div class="col-xs-12 col-md-4 mt-3" id="ph-linked_receiving"></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📦 Weight Groups (1 – 4)</div></div>
        <div class="dc-body">
            <div class="wg-grid">
                <div class="wg-box"><div class="wg-box-title">Group 1</div><div id="ph-weight_label_1"></div><div id="ph-dispatch_items_1"></div><div id="subtotal-dispatch_items_1"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 2</div><div id="ph-weight_label_2"></div><div id="ph-dispatch_items_2"></div><div id="subtotal-dispatch_items_2"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 3</div><div id="ph-weight_label_3"></div><div id="ph-dispatch_items_3"></div><div id="subtotal-dispatch_items_3"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 4</div><div id="ph-weight_label_4"></div><div id="ph-dispatch_items_4"></div><div id="subtotal-dispatch_items_4"></div></div>
            </div>
        </div>
    </div>

    <div class="dc-card is-collapsed" id="extra-card">
        <div class="dc-head collapsible" onclick="toggle_extra()">
            <div class="dc-title">📦 Additional Weight Groups (5 – 8)</div>
            <svg class="chevron" width="18" height="18" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
        </div>
        <div class="dc-body" id="extra-card-body" style="display:none;">
            <div class="wg-grid">
                <div class="wg-box"><div class="wg-box-title">Group 5</div><div id="ph-weight_label_7"></div><div id="ph-dispatch_items_7"></div><div id="subtotal-dispatch_items_7"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 6</div><div id="ph-weight_label_8"></div><div id="ph-dispatch_items_8"></div><div id="subtotal-dispatch_items_8"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 7</div><div id="ph-weight_group_7_label"></div><div id="ph-weight_group_7"></div><div id="subtotal-weight_group_7"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 8</div><div id="ph-weight_group_5_label_copy"></div><div id="ph-weight_group_5_copy"></div><div id="subtotal-weight_group_5_copy"></div></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">🥩 Offals & Variances</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-md-6">
                    <div class="offal-card">
                        <div class="offal-title">Actual Returns</div>
                        <div class="row">
                            <div class="col-xs-6 col-sm-4" id="ph-heads"></div><div class="col-xs-6 col-sm-4" id="ph-feet"></div>
                            <div class="col-xs-6 col-sm-4" id="ph-giz"></div><div class="col-xs-6 col-sm-4" id="ph-neck"></div>
                            <div class="col-xs-6 col-sm-4" id="ph-liver"></div><div class="col-xs-6 col-sm-4" id="ph-heart"></div>
                            <div class="col-xs-6 col-sm-4" id="ph-crop"></div><div class="col-xs-6 col-sm-4" id="ph-casings"></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="offal-card" style="background:#fff;border-color:#f1f5f9;">
                        <div class="offal-title">Calculated Variances</div>
                        <div class="row">
                            <div class="col-xs-6 col-sm-4" id="ph-variance_heads"></div><div class="col-xs-6 col-sm-4" id="ph-variance_feet"></div>
                            <div class="col-xs-6 col-sm-4" id="ph-variance_giz"></div><div class="col-xs-6 col-sm-4" id="ph-variance_neck"></div>
                            <div class="col-xs-6 col-sm-4" id="ph-variance_liver"></div><div class="col-xs-6 col-sm-4" id="ph-variance_heart"></div>
                            <div class="col-xs-6 col-sm-4" id="ph-variance_crop"></div><div class="col-xs-6 col-sm-4" id="ph-variance_casings"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📊 Totals & Personnel</div></div>
        <div class="dc-body">
            <div class="row" style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid #e2e8f0;">
                <div class="col-xs-6 col-md-3" id="ph-total_bags"></div><div class="col-xs-6 col-md-3" id="ph-total_units"></div>
                <div class="col-xs-6 col-md-3" id="ph-units_per_kg"></div><div class="col-xs-6 col-md-3" id="ph-brining_kg_difference"></div>
            </div>
            <div class="row">
                <div class="col-xs-12 col-md-4" id="ph-customer_rep"></div><div class="col-xs-12 col-md-4" id="ph-foreperson"></div>
                <div class="col-xs-12 col-md-4" id="ph-security"></div>
            </div>
        </div>
    </div>`;

    let $root = $('<div id="dispatch-custom-root">').html(html);
    let $page_head = $(frm.wrapper).find('.page-head');
    if ($page_head.length) { $root.insertAfter($page_head); } else { $(frm.wrapper).prepend($root); }

    window.toggle_extra = function () {
        $('#extra-card').toggleClass('is-collapsed');
        $('#extra-card-body').slideToggle(200);
    };

    let move_fields = [
        'date','time','sheet_no','customer_name','product','dispatch_type','linked_receiving',
        'heads','feet','giz','neck','liver','heart','crop','casings',
        'variance_heads','variance_feet','variance_giz','variance_neck',
        'variance_liver','variance_heart','variance_crop','variance_casings',
        'total_bags','total_units','units_per_kg','brining_kg_difference',
        'customer_rep','foreperson','security',
        'weight_label_1','dispatch_items_1','weight_label_2','dispatch_items_2',
        'weight_label_3','dispatch_items_3','weight_label_4','dispatch_items_4',
        'weight_label_7','dispatch_items_7','weight_label_8','dispatch_items_8',
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