frappe.ui.form.on('Chekuda Bin', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            frappe.call({
                method: 'havano_abattoir.havano_abattoir.doctype.chekuda_bin.chekuda_bin.get_chekuda_balance',
                callback: function(r) {
                    if (r.message) {
                        let msg = "<b>Current Chekuda Bin Balance:</b><br>";
                        msg += "<u>Offals (KG):</u> ";
                        let offal_parts = [];
                        for (let type in r.message.offals) {
                            if (r.message.offals[type] > 0) offal_parts.push(`${type}: ${r.message.offals[type]}kg`);
                        }
                        msg += offal_parts.length ? offal_parts.join(", ") : "Empty";
                        
                        msg += "<br><u>Birds:</u> ";
                        let bird_parts = [];
                        for (let cls in r.message.birds) {
                            if (r.message.birds[cls] > 0) bird_parts.push(`${cls}: ${r.message.birds[cls]} birds`);
                        }
                        msg += bird_parts.length ? bird_parts.join(", ") : "Empty";

                        frm.dashboard.clear_headline();
                        frm.dashboard.add_headline(msg);
                    }
                }
            });
        }
        frm.trigger('update_grid_fields');
    },
    transaction_type: function(frm) {
        if (frm.doc.transaction_type === 'Receive') {
            frm.set_value('sale_type', '');
        }
    },
    sale_type: function(frm) {
        frm.trigger('update_grid_fields');
    },
    update_grid_fields: function(frm) {
        let is_bulk = frm.doc.sale_type === 'Bulk';
        
        // Update Offal Items grid
        frm.fields_dict.offal_details.grid.get_field('sacks').hidden = !is_bulk;
        frm.fields_dict.offal_details.grid.get_field('packs_per_sack').hidden = !is_bulk;
        frm.fields_dict.offal_details.grid.get_field('total_packs').hidden = !is_bulk;
        frm.fields_dict.offal_details.grid.refresh();

        // Update Bird Items grid
        frm.fields_dict.bird_details.grid.get_field('sacks').hidden = !is_bulk;
        frm.fields_dict.bird_details.grid.get_field('birds_per_sack').hidden = !is_bulk;
        frm.fields_dict.bird_details.grid.refresh();
    }
});

frappe.ui.form.on('Chekuda Bin Offal Item', {
    sacks: function(frm, cdt, cdn) { calculate_offal_sale(frm, cdt, cdn); },
    packs_per_sack: function(frm, cdt, cdn) { calculate_offal_sale(frm, cdt, cdn); },
    weight_kgs: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        if (frm.doc.sale_type !== 'Bulk' || !row.total_packs) {
            // If not bulk, total packs = weight (assuming 1kg per pack)
            frappe.model.set_value(cdt, cdn, 'total_packs', row.weight_kgs);
        }
    }
});

function calculate_offal_sale(frm, cdt, cdn) {
    let row = frappe.get_doc(cdt, cdn);
    if (frm.doc.sale_type === 'Bulk') {
        let total = (row.sacks || 0) * (row.packs_per_sack || 0);
        frappe.model.set_value(cdt, cdn, 'total_packs', total);
        // Assume each pack is 1kg
        frappe.model.set_value(cdt, cdn, 'weight_kgs', total);
    }
}

frappe.ui.form.on('Chekuda Bin Item', {
    sacks: function(frm, cdt, cdn) { calculate_bird_sale(frm, cdt, cdn); },
    birds_per_sack: function(frm, cdt, cdn) { calculate_bird_sale(frm, cdt, cdn); }
});

function calculate_bird_sale(frm, cdt, cdn) {
    let row = frappe.get_doc(cdt, cdn);
    if (frm.doc.sale_type === 'Bulk') {
        let total = (row.sacks || 0) * (row.birds_per_sack || 0);
        frappe.model.set_value(cdt, cdn, 'birds', total);
    }
}
