frappe.ui.form.on('Receiving', {
    onload: function (frm) {
        if (frm.is_new()) {
            frm.set_value('date', frappe.datetime.get_today());
            frm.set_value('time', frappe.datetime.now_time());

            // Auto-fetch the next sheet number instantly
            frappe.call({
                method: 'havano_abattoir.havano_abattoir.doctype.receiving.receiving.get_next_sheet_no',
                callback: function (r) {
                    if (r.message && !frm.doc.sheet_no) {
                        frm.set_value('sheet_no', r.message);
                    }
                }
            });
        }
    },
    refresh: function (frm) {
        if (frm.is_new()) {
            frm.set_value('time', frappe.datetime.now_time());
        }

        if (!frm.is_new()) {
            frm.add_custom_button(__('Sync Dispatch Status'), function () {
                frm.call('sync_dispatch_status').then(r => {
                    frappe.show_alert({ message: __('Status Updated: {0}', [r.message]), indicator: 'green' });
                    frm.refresh();
                });
            }, __('Actions'));
        }

        // Only rebuild the layout when switching to a different document.
        if (frm.custom_ui_doc !== frm.doc.name) {
            frm.custom_ui_doc = frm.doc.name;
            $(frm.wrapper).find('#receiving-custom-root').remove();
            frm.custom_ui_rendered = false;
            setTimeout(() => { render_custom_form(frm); }, 150);
        }
    }
});

frappe.ui.form.on('Receiving Item', {
    live_units: function (frm) { calc_receiving(frm); },
    kg: function (frm) { calc_receiving(frm); },
    receiving_items_add: function (frm) { calc_receiving(frm); },
    receiving_items_remove: function (frm) { calc_receiving(frm); }
});

function calc_receiving(frm) {
    let birds = 0, kgs = 0;
    (frm.doc.receiving_items || []).forEach(function (r) {
        birds += parseInt(r.live_units || 0);
        kgs += parseInt(r.kg || 0);
    });

    // Update Sub-total in table UI
    let $st = $(frm.wrapper).find('#rcv-table-total');
    if ($st.length) {
        $st.html(`
            <div style="display:flex; justify-content:flex-end; gap:20px; font-size:12px; font-weight:700; color:#334155; padding:10px; background:#f8fafc; border-top:1px solid #e2e8f0; border-radius:0 0 10px 10px;">
                <span>TABLE TOTAL:</span>
                <span>${birds} Birds</span>
                <span>${kgs.toFixed(2)} KG</span>
            </div>
        `);
    }

    frm.set_value('total_live_birds', birds);
    frm.set_value('total_kgs', kgs);
    frm.set_value('average_live_weight', birds > 0 ? parseFloat((kgs / birds).toFixed(3)) : 0);
}

// ─── PREMIUM UI ENGINE FOR RECEIVING ──────────────────────────────────
// Moves native Frappe fields into a customs card-based layout.
// ──────────────────────────────────────────────────────────────────────

function render_custom_form(frm) {
    if (frm.custom_ui_rendered) return;
    frm.custom_ui_rendered = true;

    let html = `
    <style>
        #receiving-custom-root {
            padding: 16px 20px 40px;
            background: #f1f5f9;
            box-sizing: border-box;
        }
        #receiving-custom-root .frappe-control[data-fieldtype="Column Break"],
        #receiving-custom-root .frappe-control[data-fieldtype="Section Break"] { display: none !important; }

        /* Cards */
        .rcv-card {
            background: #fff;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            margin-bottom: 20px;
            overflow: visible;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
        }
        .rcv-head {
            padding: 14px 20px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
            border-radius: 10px 10px 0 0;
        }
        .rcv-title { font-size: 15px; font-weight: 700; color: #334155; margin: 0; display: flex; align-items: center; gap: 8px; }
        .rcv-body { padding: 20px; }

        /* ── Compact child table grid ─────────────────────────── */
        .rcv-card .grid-heading-row .row,
        .rcv-card .data-row.row {
            display: flex !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
        }
        .rcv-card .grid-heading-row .row > [class*="col-"],
        .rcv-card .data-row.row > [class*="col-"] {
            flex: 1 1 0 !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            float: none !important;
        }
        .rcv-card .col.row-check,
        .rcv-card .col.row-index {
            flex: 0 0 28px !important;
            max-width: 28px !important;
            min-width: 28px !important;
        }
        /* Proportional widths for Receiving fields */
        .rcv-card [data-fieldname="live_units"],
        .rcv-card [data-fieldname="kg"] {
            flex: 1.5 1 0 !important;
        }

        .rcv-card .grid-body .data-row .col,
        .rcv-card .grid-heading-row .col { padding: 4px 6px !important; }
        .rcv-card .grid-footer .btn { padding: 4px 10px !important; font-size: 12px !important; }
        
        /* Summary Styling */
        .summary-box {
            background: #fdf2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 15px;
            height: 100%;
        }
        .summary-label { font-size: 12px; font-weight: 600; color: #991b1b; text-transform: uppercase; margin-bottom: 8px; }
    </style>

    <!-- Card 1: Receiving Information -->
    <div class="rcv-card">
        <div class="rcv-head"><div class="rcv-title">📅 Receiving Information</div></div>
        <div class="rcv-body">
            <div style="display: flex; flex-wrap: wrap; gap: 16px;">
                <div style="flex: 1; min-width: 140px;" id="ph-date"></div>
                <div style="flex: 1; min-width: 100px;" id="ph-time"></div>
                <div style="flex: 1; min-width: 140px;" id="ph-sheet_no"></div>
                <div style="flex: 2; min-width: 200px;" id="ph-customer_name"></div>
                <div style="flex: 1; min-width: 140px;" id="ph-ambient_temperature"></div>
            </div>
        </div>
    </div>

    <!-- Card 2: Items Table -->
    <div class="rcv-card">
        <div class="rcv-head"><div class="rcv-title">📦 Receiving Items</div></div>
        <div class="rcv-body" style="padding:0;">
            <div id="ph-receiving_items" style="padding:20px;"></div>
            <div id="rcv-table-total"></div>
        </div>
    </div>

    <!-- Card 3: Summary & Personnel -->
    <div class="rcv-card">
        <div class="rcv-head"><div class="rcv-title">📊 Totals & Staff</div></div>
        <div class="rcv-body">
            <div class="row" style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid #e2e8f0;">
                <div class="col-md-3">
                    <div class="summary-box">
                        <div class="summary-label">Total Volume</div>
                        <div id="ph-total_live_birds"></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="summary-box" style="background:#f0f9ff; border-color:#bae6fd;">
                        <div class="summary-label" style="color:#075985;">Total Weight (KG)</div>
                        <div id="ph-total_kgs"></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="summary-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                        <div class="summary-label" style="color:#166534;">Average Weight</div>
                        <div id="ph-average_live_weight"></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="summary-box" style="background:#fff7ed; border-color:#fdba74;">
                        <div class="summary-label" style="color:#9a3412;">Dispatch Status</div>
                        <div id="ph-dispatch_status"></div>
                    </div>
                </div>
            </div>
            <div class="row" style="margin-bottom:15px;" id="dispatched-progress-row">
                <div class="col-md-12">
                   <div style="font-size:11px; color:#64748b; margin-bottom:4px;"><b>Birds Dispatched So Far</b></div>
                   <div id="ph-total_dispatched_units" style="font-weight:700; font-size:16px;"></div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-4" id="ph-customer_rep"></div>
                <div class="col-md-4" id="ph-foreperson"></div>
                <div class="col-md-4" id="ph-security"></div>
            </div>
        </div>
    </div>`;

    // Initialize root
    let $root = $('<div id="receiving-custom-root">').html(html);

    // Insert after page-head
    let $page_head = $(frm.wrapper).find('.page-head');
    if ($page_head.length) {
        $root.insertAfter($page_head);
    } else {
        $(frm.wrapper).prepend($root);
    }

    // Move all scalar fields
    let scalar_fields = [
        'date', 'time', 'sheet_no', 'customer_name', 'ambient_temperature',
        'total_live_birds', 'total_kgs', 'average_live_weight',
        'dispatch_status', 'total_dispatched_units',
        'customer_rep', 'foreperson', 'security'
    ];
    scalar_fields.forEach(fname => {
        let f = frm.fields_dict[fname];
        if (f && f.wrapper) {
            $root.find('#ph-' + fname).append(f.wrapper);
            $(f.wrapper).css('margin-bottom', '0');
        }
    });

    // Move the table
    let t = frm.fields_dict['receiving_items'];
    if (t && t.wrapper) {
        $root.find('#ph-receiving_items').append(t.wrapper);
    }

    // Hide native Frappe chrome
    $(frm.wrapper).find('.page-form').hide();
    $(frm.wrapper).find('.form-layout').hide();
    $(frm.wrapper).find('.layout-main-section-wrapper').hide();
    $(frm.wrapper).find('.layout-side-section').hide();
}
