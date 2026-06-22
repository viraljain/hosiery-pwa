import { supabase } from './supabase';

export async function getDealers() {
    return supabase.from('dealers').select('id, name, city').order('name', { ascending: true });
}

export async function getProductsBase() {
    return supabase.from('products_base').select('id, base_name, category').order('base_name', { ascending: true });
}

export async function getSkusByProductBase(productBaseId: string) {
    return supabase
        .from('skus').select('id, full_name, size_label, size_cm, base_id')
        .eq('base_id', productBaseId)
        .order('size_cm', { ascending: true, nullsFirst: false })
        .order('size_label', { ascending: true });
}

export async function createMatrixOrder(payload: {
    dealer_id: string;
    base_id: string;
    quantities: Record<string, number>;
    salesperson: string;
    narration?: string;
}) {
    return supabase
        .from('orders_matrix')
        .insert({
            dealer_id: payload.dealer_id,
            base_id: payload.base_id,
            quantities: payload.quantities,
            salesperson: payload.salesperson,
            narration: payload.narration || null
        })
        .select('id, created_at')
        .single();
}

export async function getOrdersMatrix() {
    return supabase.from('orders_matrix')
        .select('order_id, dealer: dealer_id(id, name, phone, city), base:base_id(id, base_name, category, base_name_nick), quantities, salesperson, narration, created_at, price, SGMChallanNum, index')
        .order('created_at', { ascending: false }).order('index', {ascending: true});
}

export async function getOrderbyId(orderId: string) {
    return supabase.from('orders_matrix')
        .select('order_id, dealer: dealer_id(id, name, phone, city), base:base_id(id, base_name, category, base_name_nick), quantities, salesperson, narration, created_at, price, SGMChallanNum, index')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false }).order('index', {ascending: true});
}

export async function searchProducts(query: string) {
    const { data, error } = await supabase
        .from("products_base")
        // .select("id, base_name")
        .select("id, base_name, base_name_nick")
        .ilike("base_name", `%${query}%`)
        .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
}

export async function searchDealers(query: string) {
    const { data, error } = await supabase
        .from("dealers")
        .select("id, name, phone, city")
        .ilike("name", `%${query}%`)
        .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
}

//included on 08-Feb-2026 2159 IST
export async function deleteOrderMatrix(orderId: string) {
    // 1. Fetch the order
    const { data: order, error: fetchErr } = await supabase
        .from('orders_matrix')
        .select('id, order_id, dealer_id, base_id, quantities, salesperson, narration, created_at, price')
        .eq('order_id', orderId);

    if (fetchErr || !order) throw new Error(fetchErr?.message || 'Order not found');

    // Optional: log how many rows we're handling
  console.log(`Archiving ${order.length} row(s) for order ${orderId}`);
    
    // 2. Move to bin (keep original id + add deleted_at)
    const rowsToArchive = order.map(row=>({
        ...row, 
        deleted_at: new Date().toISOString()
    }));
    const { error: insertErr } = await supabase
        .from('orders_matrix_deleted')
        .insert(rowsToArchive);

    if (insertErr) throw new Error(insertErr.message + 'xxxxxxx');

    // 3. Delete from active table
    return supabase.from('orders_matrix').delete().eq('order_id', orderId);
}
