// src/app/api/orders/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";


export async function POST(req: Request) {
    try {
        // const { dealer_id, items, narration } = await req.json();
        const { pl_order_id, pl_dealer_id, pl_items, pl_narration } = await req.json();
        if (!pl_dealer_id) return NextResponse.json({ error: "dealer_id required" }, { status: 400 });
        if (!Array.isArray(pl_items) || pl_items.length === 0) {
            return NextResponse.json({ error: "No items provided" }, { status: 400 });
        }

        // Use UUID if not provided for NEW ORDER, else use order_id for MODIFY
        const orderId = typeof pl_order_id === "string" && pl_order_id.trim().length > 0 ? pl_order_id : crypto.randomUUID();
        const now = new Date().toISOString();

        const rows = pl_items
            .filter((i: any) => i.base_id)
            .map((i: any) => ({
                order_id: orderId,
                dealer_id:pl_dealer_id,
                index: i.index,
                base_id: i.base_id,
                quantities: i.quantities, // jsonb column recommended
                created_at: now,
                narration: pl_narration || null,
                price: i.price || null,
            }));

        // const supabase = serverSupabase();
        // const { error } = await supabase.from("orders_matrix").insert(rows);
        if (typeof pl_order_id === "string" && pl_order_id.trim().length > 0) {
            const { error } = await supabase.from("orders_matrix").delete().eq("order_id", pl_order_id);
            if (error) return NextResponse.json({ error: "Order UPDATE " + pl_order_id + " delete failed - " + error.message }, { status: 400 });
        }
        const { error } =
            await supabase.from("orders_matrix").insert(rows);

        if (error) return NextResponse.json({ error: "Order " + orderId + " save failed - " + error.message }, { status: 400 });

        return NextResponse.json({ order_id: orderId }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Unexpected error" }, { status: 500 });
    }
}