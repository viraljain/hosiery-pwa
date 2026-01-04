import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 });
    }

    // Generate a single order_id for grouping
    const orderId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Build rows for orders_matrix
    const rows = items
      .filter(i => i.productId)
      .map(i => ({
        order_id: orderId,
        product_id: i.productId,
        quantities: i.quantities, // JSON/JSONB column recommended
        created_at: now,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ error: "No valid products selected" }, { status: 400 });
    }

    const { error } = await supabase.from("orders_matrix").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ order_id: orderId }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Unexpected error" }, { status: 500 });
  }
}
