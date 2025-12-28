import {supabase} from './supabase';

export async function getDealers() {
    return supabase.from('dealers')
}