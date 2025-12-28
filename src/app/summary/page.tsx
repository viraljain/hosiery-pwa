// app/summary/page.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { getDealers, getOrdersMatrix, getSkusByProductBase } from '@/lib/data';

export default function SummaryPage() {
  const [dealers, setDealers] = useState<any[]>([]);
  const [dealerId, setDealerId] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    getDealers().then(({ data }) => setDealers(data ?? []));
  }, []);

  useEffect(() => {
    getOrdersMatrix().then(({ data }) => {
      const list = (data ?? []).filter((o: any) => !dealerId || o.dealer?.id === dealerId);
      setOrders(list);
    });
  }, [dealerId]);

  useEffect(() => {
    async function flatten() {
      const out: any[] = [];
      for (const o of orders) {
        const baseId = o.base?.id;
        const baseName = o.base?.base_name;
        const { data: skus } = await getSkusByProductBase(baseId);
        const bySizeLabel: Record<string, any> = {};
        (skus ?? []).forEach((s: any) => { bySizeLabel[s.size_label] = s; });

        const q = o.quantities || {};
        for (const size_label of Object.keys(q)) {
          const qty = q[size_label] ?? 0;
          if (qty > 0) {
            const sku = bySizeLabel[size_label];
            out.push({
              id: `${o.id}-${size_label}`,
              dealer: o.dealer?.name,
              city: o.dealer?.city,
              base_name: baseName,
              size_label,
              full_name: sku?.full_name ?? `${baseName} ${size_label}`,
              qty,
              time: o.created_at
            });
          }
        }
      }
      setRows(out);
    }
    flatten();
  }, [orders]);

  const totalsByBase = useMemo(() => {
    const agg: Record<string, number> = {};
    rows.forEach(r => {
      agg[r.base_name] = (agg[r.base_name] ?? 0) + r.qty;
    });
    return agg;
  }, [rows]);

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">Order summary</h1>

      <div className="space-y-2">
        <label className="text-sm font-medium">Filter by dealer</label>
        <select className="w-full border rounded p-2" value={dealerId} onChange={e => setDealerId(e.target.value)}>
          <option value="">All dealers</option>
          {dealers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.city})</option>)}
        </select>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Dealer</th>
              <th className="text-left p-2">Product</th>
              <th className="text-left p-2">Size</th>
              <th className="text-left p-2">Tally name</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-left p-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.dealer} ({r.city})</td>
                <td className="p-2">{r.base_name}</td>
                <td className="p-2">{r.size_label}</td>
                <td className="p-2">{r.full_name}</td>
                <td className="p-2 text-right">{r.qty}</td>
                <td className="p-2">{new Date(r.time).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="text-lg font-medium">Totals by product</h2>
        <ul className="list-disc pl-6">
          {Object.entries(totalsByBase).map(([name, qty]) => (
            <li key={name}>{name}: {qty}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
