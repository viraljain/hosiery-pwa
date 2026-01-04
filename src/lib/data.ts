import {supabase} from './supabase';

export async function getDealers() {
    return supabase.from('dealers').select('id, name, city').order('name', {ascending: true});
}

export async function getProductsBase(){
    return supabase.from('products_base').select('id, base_name, category').order('base_name', {ascending: true});
}

export async function getSkusByProductBase(productBaseId: string) {
    return supabase
        .from('skus').select('id, full_name, size_label, size_cm, base_id')
        .eq('base_id', productBaseId)
        .order('size_cm', {ascending: true, nullsFirst: false})
        .order('size_label', {ascending: true});
}

export async function createMatrixOrder(payload: {
    dealer_id: string;
    base_id: string;
    quantities: Record<string, number>;
    salesperson: string;
    notes?: string; 
}){
    return supabase
    .from('orders_matrix')
    .insert({
        dealer_id: payload.dealer_id,
        base_id: payload.base_id,
        quantities: payload.quantities,
        salesperson: payload.salesperson,
        notes: payload.notes || null
    })
    .select('id, created_at')
    .single();
}

export async function getOrdersMatrix(){
    return supabase.from('orders_matrix')
    .select('id, dealer: dealer_id(id, name, city), base:base_id(id, base_name, category), quantities, salesperson, notes, created_at')
    .order('created_at', {ascending: false});
}

export async function getOrderbyId(orderId: string){
    return supabase.from('orders_matrix')
    .select('id, dealer: dealer_id(id, name), base:base_id(id, base_name, category), quantities, salesperson, notes, created_at')
    .eq('id', orderId)
    .order('created_at', {ascending: false});
}

export async function searchProducts(query: string) {
   const { data, error } = await supabase
    .from("products_base")
    .select("id, base_name")
    .ilike("base_name", `%${query}%`)
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function searchDealers(query: string) {
  const { data, error } = await supabase
    .from("dealers")
    .select("id, name, phone")
    .ilike("name", `%${query}%`)
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}
