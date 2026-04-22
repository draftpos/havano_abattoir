frappe.ui.form.on('Processing', {

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

        if (frm.custom_ui_doc !== frm.doc.name) {
            frm.custom_ui_doc = frm.doc.name;
            $(frm.wrapper).find('#processing-custom-root').remove();
            frm.custom_ui_rendered = false;
            setTimeout(() => { render_custom_form(frm); }, 150);
        }

        // Filter: Hide fully processed Receiving records and only show submitted ones
        frm.set_query('linked_receiving', function () {
            return {
                filters: [
                    ['Receiving', 'docstatus', '=', 1],
                    ['Receiving', 'processing_status', '!=', 'Fully Processed']
                ]
            };
        });

        // Enable "Link Title" view for standard fetching/naming
        const link_fields = ['customer_name', 'linked_receiving', 'customer_rep', 'foreperson', 'security'];
        link_fields.forEach(f => {
            frm.set_df_property(f, 'show_title_field_in_link', 1);
        });

        // Load baselines for existing records
        if (frm.doc.linked_receiving) {
            set_receiving_baselines(frm);
        }
    },

    on_submit: function (frm) {
        if (frm.brining_redirect) {
            create_brining_from_processing(frm);
        }

        frappe.msgprint({
            title: __('Success'),
            indicator: 'green',
            message: __('Processing record submitted. Data has been moved to the <b>' + (frm.doc.workflow_next_step || 'next') + '</b> stage.')
        });
    },

    linked_receiving: function (frm) {
        if (frm.doc.linked_receiving) {
            set_receiving_baselines(frm, true);
        }
    },

    before_submit: function (frm) {
        if (!frm.selection_done) {
            frappe.validated = false;
            show_processing_selection_dialog(frm);
        }
    },

    validate: function (frm) {
        if (frm.doc.linked_receiving) {
            if (frm.doc.total_units > (frm.expected_birds || 0)) {
                frappe.msgprint({
                    title: __('Validation Error'),
                    message: __('Total Units (<b>{0}</b>) cannot exceed Birds in Linked Receiving (<b>{1}</b>).',
                        [frm.doc.total_units, frm.expected_birds]),
                    indicator: 'red'
                });
                frappe.validated = false;
            }

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

frappe.ui.form.on('Processing Item', {
    units: function (frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        let table_name = row.parentfield;

        let multiplier_field = table_name.replace('processing_items_', 'weight_label_');
        if (table_name === 'weight_group_7') multiplier_field = 'weight_group_7_label';
        if (table_name === 'weight_group_5_copy') multiplier_field = 'weight_group_5_label_copy';

        let label_val = frm.doc[multiplier_field] || "";
        let multiplier = parseFloat(label_val.toString().replace(',', '.')) || 0;

        if (multiplier === 0 && frm.rcv_avg_weight) {
            multiplier = frm.rcv_avg_weight;
        }

        if (row.units && multiplier > 0) {
            frappe.model.set_value(cdt, cdn, 'kg', parseFloat((row.units * multiplier).toFixed(3)));
        }
        calculate_totals(frm);
    },
    kg: function (frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        if (typeof row.kg === 'string' && row.kg.includes(',')) {
            let val = parseFloat(row.kg.replace(',', '.'));
            if (!isNaN(val)) frappe.model.set_value(cdt, cdn, 'kg', val);
        }
        calculate_totals(frm);
    }
});

['processing_items_1', 'processing_items_2', 'processing_items_3', 'processing_items_4', 'processing_items_7', 'processing_items_8', 'weight_group_7', 'weight_group_5_copy'].forEach(table_name => {
    frappe.ui.form.on(table_name, {
        [`${table_name}_add`]: function (frm) { calculate_totals(frm); },
        [`${table_name}_remove`]: function (frm) { calculate_totals(frm); }
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
                if (!frm.doc.product) frm.set_value('product', 'Whole Birds');
                
                // Inherit Customer and Staff (IDs will be auto-resolved to Names by "Native Fetching")
                frm.set_value('customer_name', rcv.customer_name);
                frm.set_value('customer_rep', rcv.customer_rep);
                frm.set_value('foreperson', rcv.foreperson);
                frm.set_value('security', rcv.security);

                setup_offal_returns(frm);
                calculate_totals(frm);
            });
        } else {
            if (!frm.doc.offal_returns || frm.doc.offal_returns.length === 0) {
                setup_offal_returns(frm);
            }
            calculate_totals(frm);
        }
    });
}

function setup_offal_returns(frm) {
    const types = ['Heads', 'Feet', 'Giz', 'Neck', 'Liver', 'Heart', 'Crop', 'Casings'];
    const current_types = (frm.doc.offal_returns || []).map(row => row.offal_type);
    
    types.forEach(t => {
        if (!current_types.includes(t)) {
            let row = frm.add_child('offal_returns');
            row.offal_type = t;
            row.weight_kgs = 0.0;
        }
    });
    frm.refresh_field('offal_returns');
}

function calculate_totals(frm) {
    let total_units = 0, total_kgs = 0, total_bags = 0;
    let tables = ['processing_items_1', 'processing_items_2', 'processing_items_3', 'processing_items_4', 'processing_items_7', 'processing_items_8', 'weight_group_7', 'weight_group_5_copy'];

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
}

function show_processing_selection_dialog(frm) {
    let d = new frappe.ui.Dialog({
        title: '🐔 Next Workflow Step',
        fields: [
            {
                fieldtype: 'HTML',
                options: `<div style="padding:10px 0 6px;font-size:14px;color:#555;">Choose the next stage for this batch:</div>`
            },
            {
                label: 'Step',
                fieldname: 'next_step',
                fieldtype: 'Select',
                options: 'Brining\nUnbrining (Send to Storage)',
                reqd: 1
            }
        ],
        primary_action_label: '✅ Confirm',
        primary_action: function (values) {
            frm.set_value('workflow_next_step', values.next_step);
            frm.selection_done = true;
            d.hide();

            if (values.next_step === 'Brining') {
                frm.brining_redirect = true;
                frm.savesubmit();
            } else {
                frm.push_to_storage = true;
                frm.savesubmit();
            }
        }
    });
    d.show();
}

function create_brining_from_processing(frm) {
    frappe.new_doc('Brining', {
        customer_name: frm.doc.customer_name,
        product: frm.doc.product,
        linked_processing: frm.doc.name,
        sheet_no: frm.doc.sheet_no + '-B'
    });
}

function render_custom_form(frm) {
    if (frm.custom_ui_rendered) return;
    frm.custom_ui_rendered = true;

    let html = `
    <style>
        #processing-custom-root {
            padding: 16px 20px 40px;
            background: #f1f5f9;
            box-sizing: border-box;
        }
        #processing-custom-root .frappe-control[data-fieldtype="Column Break"],
        #processing-custom-root .frappe-control[data-fieldtype="Section Break"] { display: none !important; }

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

        .wg-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        @media (max-width: 992px) { .wg-grid { grid-template-columns: repeat(4, 1fr); } }
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
            flex: 0 0 35px !important;
            max-width: 35px !important;
        }
        
        .rcv-body .frappe-control { margin-bottom: 10px; }

        .offal-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            background: #f8fafc;
            height: 100%;
        }
        .offal-title {
            font-size: 12px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
    </style>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📝 Processing Information</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-date"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-time"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-sheet_no"></div>
                <div class="col-xs-12 col-sm-6 col-md-3" id="ph-customer_name"></div>
                <div class="col-xs-12 col-md-4 mt-3" id="ph-product"></div>
                <div class="col-xs-12 col-md-4 mt-3" id="ph-linked_receiving"></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">📦 Weight Groups (1 – 4)</div></div>
        <div class="dc-body">
            <div class="wg-grid">
                <div class="wg-box"><div class="wg-box-title">Group 1</div><div id="ph-weight_label_1"></div><div id="ph-processing_items_1"></div><div id="subtotal-processing_items_1"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 2</div><div id="ph-weight_label_2"></div><div id="ph-processing_items_2"></div><div id="subtotal-processing_items_2"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 3</div><div id="ph-weight_label_3"></div><div id="ph-processing_items_3"></div><div id="subtotal-processing_items_3"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 4</div><div id="ph-weight_label_4"></div><div id="ph-processing_items_4"></div><div id="subtotal-processing_items_4"></div></div>
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
                <div class="wg-box"><div class="wg-box-title">Group 5</div><div id="ph-weight_label_7"></div><div id="ph-processing_items_7"></div><div id="subtotal-processing_items_7"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 6</div><div id="ph-weight_label_8"></div><div id="ph-processing_items_8"></div><div id="subtotal-processing_items_8"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 7</div><div id="ph-weight_group_7_label"></div><div id="ph-weight_group_7"></div><div id="subtotal-weight_group_7"></div></div>
                <div class="wg-box"><div class="wg-box-title">Group 8</div><div id="ph-weight_group_5_label_copy"></div><div id="ph-weight_group_5_copy"></div><div id="subtotal-weight_group_5_copy"></div></div>
            </div>
        </div>
    </div>

    <div class="dc-card">
        <div class="dc-head"><div class="dc-title">🥩 Offal & Parts</div></div>
        <div class="dc-body">
            <div class="row">
                <div class="col-md-12">
                    <div class="offal-card" style="background:#fff;border-color:#e2e8f0;">
                        <div class="offal-title">Actual Returns (KGs)</div>
                        <div id="ph-offal_returns"></div>
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
                <div class="col-xs-6 col-md-3" id="ph-total_kgs"></div>
                <div class="col-xs-6 col-md-3" id="ph-units_per_kg"></div>
            </div>
            <div class="row">
                <div class="col-md-4"><div id="ph-customer_rep"></div></div>
                <div class="col-md-4"><div id="ph-foreperson"></div></div>
                <div class="col-md-4"><div id="ph-security"></div></div>
            </div>
        </div>
    </div>`;

    let $root = $('<div id="processing-custom-root">').html(html);
    let $page_head = $(frm.wrapper).find('.page-head');
    if ($page_head.length) { $root.insertAfter($page_head); } else { $(frm.wrapper).prepend($root); }

    window.toggle_extra = function () {
        $('#extra-card').toggleClass('is-collapsed');
        $('#extra-card-body').slideToggle(200);
    };

    let move_fields = [
        'date', 'time', 'sheet_no', 'customer_name', 'product', 'linked_receiving',
        'offal_returns',
        'total_bags', 'total_units', 'total_kgs', 'units_per_kg',
        'customer_rep', 'foreperson', 'security',
        'weight_label_1', 'processing_items_1', 'weight_label_2', 'processing_items_2',
        'weight_label_3', 'processing_items_3', 'weight_label_4', 'processing_items_4',
        'weight_label_7', 'processing_items_7', 'weight_label_8', 'processing_items_8',
        'weight_group_7_label', 'weight_group_7', 'weight_group_5_label_copy', 'weight_group_5_copy'
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