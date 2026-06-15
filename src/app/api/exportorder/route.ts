import { supabase } from '@/lib/supabase';
import sql from 'mssql';
import { getPool } from "@/lib/mssql";
import { NextResponse } from 'next/server';


export async function POST(req: Request) {
  const body = await req.json() as { orderId: string };
  const { orderId } = body;
  try {
    // 1. Fetch order from Supabase
    //const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    const { data: orders, error } = await supabase
      .from('orders_matrix')
      .select('order_id, dealer: dealer_id(id, name, city), base:base_id(id, base_name, category,BoxMultiple), quantities, salesperson, narration, created_at, price')
      .eq('order_id', orderId);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: 'Supabase error' }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Connect to SQL Server
    const pool = await getPool();

    // 3. Insert into staging header (one per order_id)
    type Dealer = { id: string; name: string; city: string };
    type Base = { id: string; base_name: string; category: string; BoxMultiple?: number };
    type Quantity = { name: string; size: string; qty: number };


    //console.log('Fetched order from Supabase:', orders);


    await pool.request()
      .input('OrderMatrixId', sql.UniqueIdentifier, orders[0].order_id)
      .input('DealerName', sql.VarChar(100), (orders[0].dealer as unknown as Dealer).name ?? null)
      .input('DealerCode', sql.VarChar(50), (orders[0].dealer as unknown as Dealer).id ?? null)
      .input('Remarks', sql.VarChar(200), orders[0].narration ?? '')
      .input('TotalItemQty', sql.Int, 0) // Placeholder, will update later
      .query(`
      INSERT INTO tblHFOChallanTemp_Header (OrderMatrixId,DealerName, DealerCode, Remarks, TotalItemQty, ChallanDate)
      VALUES (@OrderMatrixId, @DealerName,@DealerCode, @Remarks, @TotalItemQty, GETDATE())
    `);
    var totalQty = 0;

    for (const row of orders) {
      const base = row.base as unknown as Base;       // take first base

      //console.log('BASE :', base);
      // Normalize quantities
      const quantities = normalizeQuantities(row.quantities);

      // Header insert (once per order_id)
      totalQty += quantities.reduce((sum, q) => sum + (q.qty*(base.BoxMultiple ?? 1)), 0);

      // Detail insert
      for (const item of quantities) {
        await pool.request()
          .input('BaseId', sql.UniqueIdentifier, base.id ?? null)
          .input('ItemName', sql.VarChar(100), base?.base_name ?? '')
          .input('ItemSize', sql.VarChar(50), item.size)
          .input('ItemQty', sql.Int, item.qty * (base.BoxMultiple ?? 1))
          .input('Price', sql.Decimal(18, 2), row.price ?? 0)
          .input('HeaderOrderMatrixId', sql.UniqueIdentifier, row.order_id)
          .query(`
        INSERT INTO tblHFOChallanTemp (HeaderOrderMatrixId, BaseId, ItemName, ItemSize, ItemQty, Price)
        VALUES (@HeaderOrderMatrixId, @BaseId, @ItemName, @ItemSize, @ItemQty, @Price)
      `);
      }
    }

    // Update header with computed total
    await pool.request()
      .input('OrderMatrixId', sql.UniqueIdentifier, orders[0].order_id)
      .input('TotalItemQty', sql.Int, totalQty)
      .query(`
    UPDATE tblHFOChallanTemp_Header
    SET TotalItemQty = @TotalItemQty
    WHERE OrderMatrixId = @OrderMatrixId
  `);


    // 5. Call stored procedure to process into Vch_Hd + Vch_Dtl
    const result = await pool.request()
    .input('OrderMatrixId', sql.UniqueIdentifier, orders[0].order_id)
    .execute('sp_ChallanHFOOrder');

    console.log('Stored procedure result:', result.recordset[0]['']);

    await supabase
      .from('orders_matrix')
      .update({ SGMChallanNum: result.recordset[0][''], SGMExportTime: new Date().toISOString() })
      .eq('order_id', orderId);

    return NextResponse.json({ message: 'Order exported to SGM Challan '+result.recordset[0]['']});

  }
  catch (err: any) {
    console.error('SQL Error:', err);

    return NextResponse.json(
      { error: err.message ?? `Order(${orderId}) Export failed - `},
      { status: 500 }
    );
  }
}

// Convert { '80': 20, '85': 30 } → [ { size: '80', qty: 20 }, { size: '85', qty: 30 } ]
function normalizeQuantities(qtyObj: Record<string, number>) {
  return Object.entries(qtyObj).map(([size, qty]) => ({
    size,
    qty
  }));
}
