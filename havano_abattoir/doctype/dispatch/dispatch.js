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

        // Render Custom Form View
        setTimeout(() => { render_custom_form(frm); }, 100);

        // Show dispatch type badge
        if (frm.doc.dispatch_type) {
            let color = frm.doc.dispatch_type === 'Brining' ? 'orange' : 'green';
            frm.page.set_indicator(frm.doc.dispatch_type, color);
        }

        // Add Brining dispatch button if this was Unbrining and is submitted
        if (frm.doc.dispatch_type === 'Unbrining' && frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Create Brining Dispatch'), function () {
                create_brining_dispatch(frm);
            }, __('Actions'));
        }
    },

    before_save: function (frm) {
        // Only ask on first save if dispatch_type not set
        if (!frm.doc.dispatch_type) {
            frappe.validated = false;
            show_dispatch_type_dialog(frm);
        }
    }
});

// Child table triggers - Primary
frappe.ui.form.on('Dispatch Item', {
    units: function (frm) { calculate_totals(frm); },
    kg: function (frm) { calculate_totals(frm); },
    dispatch_items_remove: function (frm) { calculate_totals(frm); },
    dispatch_items_extra_remove: function (frm) { calculate_totals(frm); }
});

function show_dispatch_type_dialog(frm) {
    let d = new frappe.ui.Dialog({
        title: '🐔 Select Dispatch Type',
        fields: [
            {
                fieldtype: 'HTML',
                options: `
                    <div style="padding:10px 0; font-size:14px; color:#555;">
                        Choose how this batch is being dispatched:
                    </div>
                `
            }
        ],
        primary_action_label: '✅ Unbrining (Direct Dispatch)',
        primary_action: function () {
            frm.set_value('dispatch_type', 'Unbrining');
            d.hide();
            frappe.validated = true;
            frm.save();
        },
        secondary_action_label: '🧊 Brining (Add Weight)',
        secondary_action: function () {
            frm.set_value('dispatch_type', 'Brining');
            d.hide();
            frappe.validated = true;
            frm.save();
        }
    });
    d.show();
}

function calculate_totals(frm) {
    let total_units = 0;
    let total_kgs = 0.0;
    let total_bags = 0;

    let all_items = (frm.doc.dispatch_items || []).concat(frm.doc.dispatch_items_extra || []);

    all_items.forEach(function (row) {
        let u = parseInt(row.units || 0);
        let k = parseFloat(row.kg || 0);
        total_units += u;
        total_kgs += k;
        if (u > 0) total_bags++;
    });

    frm.set_value('total_units', total_units);
    frm.set_value('total_bags', total_bags);

    if (total_kgs > 0) {
        frm.set_value('units_per_kg', parseFloat((total_units / total_kgs).toFixed(3)));
    } else {
        frm.set_value('units_per_kg', 0);
    }

    calculate_variance(frm, total_units);
}

function calculate_variance(frm, total_units) {
    let parts = ['heads', 'feet', 'giz', 'neck', 'liver', 'heart', 'crop', 'casings'];
    parts.forEach(function (part) {
        let actual = parseInt(frm.doc[part] || 0);
        frm.set_value('variance_' + part, total_units - actual);
    });
}


// -------------------------------------------------------------
// CUSTOM HTML FORM INJECTION LOGIC
// -------------------------------------------------------------

function render_custom_form(frm) {
    if (frm.custom_ui_rendered) {
        // Just refresh the weights if already rendered
        if(frm.fields_dict.custom_dispatch_layout && frm.fields_dict.custom_dispatch_layout.$wrapper){
            render_weight_groups(frm, frm.fields_dict.custom_dispatch_layout.$wrapper.find('#custom-weight-groups'), true);
        }
        return;
    }
    
    let custom_field = frm.get_field('custom_dispatch_layout');
    if (!custom_field || !custom_field.$wrapper) return;

    frm.custom_ui_rendered = true;
    let custom_wrapper = custom_field.$wrapper;

    // Beautiful UI Template with Collapsible Sections
    let template = `
        <style>
            .app-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            .collapse-card { 
                background: #ffffff; 
                border: 1px solid #d1d5db; 
                border-radius: 8px; 
                margin-bottom: 20px; 
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                overflow: hidden;
            }
            .card-header { 
                padding: 16px 20px; 
                background: #f8fafc; 
                border-bottom: 1px solid #e2e8f0; 
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: background 0.2s;
            }
            .card-header:hover { background: #f1f5f9; }
            .card-title { font-size: 15px; font-weight: 600; color: #1e293b; margin: 0; display: flex; align-items: center; gap: 8px;}
            .card-body { padding: 20px; }
            .chevron { transition: transform 0.3s ease; fill: #64748b; }
            .is-collapsed .chevron { transform: rotate(-90deg); }
            
            .frappe-control[data-fieldtype="Column Break"] { display: none !important; }
            .frappe-control[data-fieldtype="Section Break"] { display: none !important; }
            
            /* Custom Weight Groups Input Styling */
            .grid-val-input { 
                width: 100%; border: 1px solid #ced4da; border-radius: 6px; 
                padding: 6px 10px; font-size: 13px; color: #334155;
            }
            .grid-val-input:focus { border-color: #3b82f6; outline: 0; box-shadow: 0 0 0 3px rgba(59,130,246,0.2); }
            
            .weight-box {
                border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; background: #fafafa;
                transition: border-color 0.2s, box-shadow 0.2s;
            }
            .weight-box:hover { border-color: #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .offal-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; height: 100%; }
            .offal-title { font-weight: 600; font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 12px; letter-spacing: 0.5px;}
        </style>
        
        <div class="app-container">
            <!-- Dispatch Info -->
            <div class="collapse-card">
                <div class="card-header" onclick="toggle_card(this)">
                    <div class="card-title">📝 Dispatch Information</div>
                    <svg class="chevron" width="20" height="20" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                </div>
                <div class="card-body row">
                    <div class="col-xs-12 col-sm-6 col-md-3" id="ph-date"></div>
                    <div class="col-xs-12 col-sm-6 col-md-3" id="ph-time"></div>
                    <div class="col-xs-12 col-sm-6 col-md-3" id="ph-sheet_no"></div>
                    <div class="col-xs-12 col-sm-6 col-md-3" id="ph-customer_name"></div>
                    
                    <div class="col-xs-12 col-md-4 mt-3" id="ph-product"></div>
                    <div class="col-xs-12 col-md-4 mt-3" id="ph-dispatch_type"></div>
                    <div class="col-xs-12 col-md-4 mt-3" id="ph-linked_receiving"></div>
                </div>
            </div>

            <!-- Weight Groups -->
            <div class="collapse-card">
                <div class="card-header" onclick="toggle_card(this)">
                    <div class="card-title">📦 Dispatched Weight Groups</div>
                    <svg class="chevron" width="20" height="20" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                </div>
                <div class="card-body" id="custom-weight-groups">
                    <!-- Dynamic weight groups injected here -->
                </div>
            </div>

            <!-- Offals & Variances -->
            <div class="collapse-card">
                <div class="card-header" onclick="toggle_card(this)">
                    <div class="card-title">🥩 Offals & Variances</div>
                    <svg class="chevron" width="20" height="20" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6 mb-4 mb-md-0">
                            <div class="offal-card">
                                <div class="offal-title">Actual Returns</div>
                                <div class="row row-cols-3">
                                    <div class="col-xs-6 col-sm-4" id="ph-heads"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-feet"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-giz"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-neck"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-liver"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-heart"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-crop"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-casings"></div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="offal-card" style="background:#fff; border-color:#f1f5f9;">
                                <div class="offal-title">Calculated Variances</div>
                                <div class="row row-cols-3">
                                    <div class="col-xs-6 col-sm-4" id="ph-variance_heads"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-variance_feet"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-variance_giz"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-variance_neck"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-variance_liver"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-variance_heart"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-variance_crop"></div>
                                    <div class="col-xs-6 col-sm-4" id="ph-variance_casings"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Totals & Staff -->
            <div class="collapse-card">
                <div class="card-header" onclick="toggle_card(this)">
                    <div class="card-title">📊 Totals & Personnel</div>
                    <svg class="chevron" width="20" height="20" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
                </div>
                <div class="card-body">
                    <div class="row" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
                        <div class="col-xs-6 col-md-3" id="ph-total_bags"></div>
                        <div class="col-xs-6 col-md-3" id="ph-total_units"></div>
                        <div class="col-xs-6 col-md-3" id="ph-units_per_kg"></div>
                        <div class="col-xs-6 col-md-3" id="ph-brining_kg_difference"></div>
                    </div>
                    <div class="row">
                        <div class="col-xs-12 col-md-4" id="ph-customer_rep"></div>
                        <div class="col-xs-12 col-md-4" id="ph-foreperson"></div>
                        <div class="col-xs-12 col-md-4" id="ph-security"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    custom_wrapper.html(template);
    
    // Add slide toggle logic explicitly globally to window so inline onclick works
    window.toggle_card = function(el) {
        let parent = $(el).closest('.collapse-card');
        parent.toggleClass('is-collapsed');
        parent.find('.card-body').slideToggle(200);
    };

    // Pluck native fields and append to placeholders
    let fields_to_move = [
        'date', 'time', 'sheet_no', 'customer_name', 'product', 'dispatch_type', 'linked_receiving',
        'heads', 'feet', 'giz', 'neck', 'liver', 'heart', 'crop', 'casings',
        'variance_heads', 'variance_feet', 'variance_giz', 'variance_neck', 'variance_liver', 'variance_heart', 'variance_crop', 'variance_casings',
        'total_bags', 'total_units', 'units_per_kg', 'brining_kg_difference',
        'customer_rep', 'foreperson', 'security'
    ];

    fields_to_move.forEach(fname => {
        let field = frm.fields_dict[fname];
        if (field && field.wrapper) {
            custom_wrapper.find('#ph-' + fname).append(field.wrapper);
            // Optionally remove bottom padding from standard frappe fields
            $(field.wrapper).css({'margin-bottom': '0'});
        }
    });

    // Hide original sections (except our custom wrapper section)
    $(frm.wrapper).find('.form-section:not(:first)').hide();
    
    // Explicitly hide native child table fields
    frm.set_df_property('dispatch_items', 'hidden', 1);
    if (frm.fields_dict.dispatch_items_extra) {
        frm.set_df_property('dispatch_items_extra', 'hidden', 1);
    }

    // Render custom weight groups
    render_weight_groups(frm, custom_wrapper.find('#custom-weight-groups'), false);
}

function render_weight_groups(frm, container, is_refresh) {
    if(!container) return;
    
    // Prevent wiping out user focus immediately while typing
    if(is_refresh && document.activeElement && $(document.activeElement).hasClass('grid-val-input')) {
        return; 
    }

    let items = frm.doc.dispatch_items || [];
    let extra = frm.doc.dispatch_items_extra || [];
    let combined_items = items.concat(extra);
    
    // Create 12 boxes total, rendering 4 per row
    let total_boxes = Math.max(12, combined_items.length);
    
    let html = '<div class="row" style="margin-left: -10px; margin-right: -10px;">';
    
    for (let i = 0; i < total_boxes; i++) {
        let row = combined_items[i] || {weight_label: '', units: '', kg: ''};
        
        html += `
            <div class="col-xs-12 col-sm-6 col-md-3" style="padding: 10px;">
                <div class="weight-box" data-idx="${i}">
                    <div style="font-weight: 600; margin-bottom: 12px; color: #0f172a; font-size: 14px; text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 8px;">
                        Weight Group ${i+1}
                    </div>
                    <div style="margin-bottom: 10px;">
                        <label style="font-size:11px; color:#64748b; margin-bottom:4px; display:block;">Label (e.g., 1kg)</label>
                        <input type="text" class="grid-val-input w-label" value="${row.weight_label || ''}" placeholder="1kg">
                    </div>
                    <div class="row" style="margin-left: -5px; margin-right: -5px;">
                        <div class="col-xs-6" style="padding: 0 5px;">
                            <label style="font-size:11px; color:#64748b; margin-bottom:4px; display:block;">Units</label>
                            <input type="number" class="grid-val-input w-units" value="${row.units || ''}" placeholder="0">
                        </div>
                        <div class="col-xs-6" style="padding: 0 5px;">
                            <label style="font-size:11px; color:#64748b; margin-bottom:4px; display:block;">Total KG</label>
                            <input type="number" class="grid-val-input w-kg" value="${row.kg || ''}" step="0.01" placeholder="0.0">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    
    container.html(html);

    // Bind event listeners for two-way binding
    container.find('.grid-val-input').on('change', function() {
        sync_to_dispatch_items(frm, container);
    });
}

function sync_to_dispatch_items(frm, container) {
    let rows = [];
    container.find('.weight-box').each(function () {
        let label = $(this).find('.w-label').val();
        let units = parseInt($(this).find('.w-units').val()) || 0;
        let kg = parseFloat($(this).find('.w-kg').val()) || 0.0;

        if (label || units || kg) {
            rows.push({
                weight_label: label || '',
                units: units,
                kg: kg
            });
        }
    });

    // Clear both tables
    frm.clear_table('dispatch_items');
    if (frm.fields_dict.dispatch_items_extra) {
        frm.clear_table('dispatch_items_extra');
    }

    // Re-fill first 6 items into dispatch_items, the rest into extra (to maintain logic compatibility)
    rows.forEach((row_val, idx) => {
        if (idx < 6) {
            let row = frm.add_child('dispatch_items');
            row.weight_label = row_val.weight_label;
            row.units = row_val.units;
            row.kg = row_val.kg;
        } else {
            if (frm.fields_dict.dispatch_items_extra) {
                let row = frm.add_child('dispatch_items_extra');
                row.weight_label = row_val.weight_label;
                row.units = row_val.units;
                row.kg = row_val.kg;
            }
        }
    });

    frm.refresh_field('dispatch_items');
    if (frm.fields_dict.dispatch_items_extra) {
        frm.refresh_field('dispatch_items_extra');
    }

    calculate_totals(frm);
}