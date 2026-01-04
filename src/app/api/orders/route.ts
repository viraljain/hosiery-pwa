// src/app/api/orders/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
    try {
        const { dealer_id, items } = await req.json();
        if (!dealer_id) return NextResponse.json({ error: "dealer_id required" }, { status: 400 });
        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No items provided" }, { status: 400 });
        }

        const orderId = crypto.randomUUID();
        const now = new Date().toISOString();

        const rows = items
            .filter((i: any) => i.base_id)
            .map((i: any) => ({
                order_id: orderId,
                dealer_id,
                base_id: i.base_id,
                quantities: i.quantities, // jsonb column recommended
                created_at: now,
            }));

        // const supabase = serverSupabase();
        const { error } = await supabase.from("orders_matrix").insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });

        return NextResponse.json({ order_id: orderId }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Unexpected error" }, { status: 500 });
    }
}