import { NextResponse } from "next/server";
import sql from 'mssql';
import { getPool } from "@/lib/mssql";

export async function POST(req: Request) {
  const body = await req.json();
  const { DealerCode, DealerName, Remarks, TotalItemQty } = body;

try {
    console.log('Start - Hello');
    console.log(DealerCode, DealerName, Remarks, TotalItemQty);
    console.log('End - Bye');
    const pool = await getPool();
    await pool.request()
      .input('DealerCode', sql.Int, DealerCode)
      .input('DealerName', sql.VarChar(100), DealerName)
      .input('Remarks', sql.VarChar(sql.MAX), JSON.stringify(Remarks))
      .input('TotalItemQty', sql.Decimal(18,2), TotalItemQty)
      .query(`
        INSERT INTO dbo.tblNewChallanTemp_Header (DealerCode, DealerName, Remarks, TotalItemQty)
        VALUES (@DealerCode, @DealerName, @Remarks, @TotalItemQty)
      `);

    return NextResponse.json({ message: 'Order saved to SQL Server' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Database insert failed'+ err }, { status: 500 });
  }
}