// app/order/page.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { getDealers, getProductsBase, getSkusByProductBase, createMatrixOrder } from '@/lib/data';

export default function OrderPage() {
  const [dealers, setDealers] = useState<any[]>([]);
  const [bases, setBases] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);

  const [dealerId, setDealerId] = useState('');
  const [baseId, setBaseId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<string>('');
  const [encodedMessage, setEncodedMessage] = useState<string>('');

  useEffect(() => {
    getDealers().then(({ data }) => setDealers(data ?? []));
    getProductsBase().then(({ data }) => setBases(data ?? []));
  }, []);

  useEffect(() => {
    if (!baseId) { setSkus([]); setQuantities({}); return; }
    getSkusByProductBase(baseId).then(({ data }) => {
      const list = data ?? [];
      setSkus(list);
      const q: Record<string, number> = {};
      list.forEach((s: any) => { q[s.size_label] = 0; });
      setQuantities(q);
    });
  }, [baseId]);

  const total = useMemo(() => Object.values(quantities).reduce((a, b) => a + (b || 0), 0), [quantities]);

  function updateQty(size_label: string, value: number) {
    setQuantities(prev => ({ ...prev, [size_label]: Math.max(0, value) }));
  }

  async function submit() {
    if (!dealerId || !baseId) { setStatus('Select dealer and product.'); return; }
    const hasAny = Object.values(quantities).some(q => (q ?? 0) > 0);
    if (!hasAny) { setStatus('Enter at least one size quantity.'); return; }

    const { error } = await createMatrixOrder({
      dealer_id: dealerId,
      base_id: baseId,
      quantities,
      salesperson: 'web_app_user' // hardcoded for now
    });
    if (error) setStatus(`Error: ${error.message}`);
    else {
      setStatus('Order saved.');

      //Setup Whatsapp message
      const dealerName = dealers.find(d => d.id === dealerId).name || '';  
      const dealerCity = dealers.find(d => d.id === dealerId).city || '';
      const productName = bases.find(b => b.id === baseId)?.base_name || '';
      const totalQty = Object.values(quantities).reduce((a, b) => a + (b || 0), 0);
      const message = `${dealerName} (${dealerCity})\n`
                      + `${productName}\n`
                      + `${Object.entries(quantities)
                        .map(([size, qty]) => `${size}/${qty}`)
                        .filter(entry => !entry.endsWith('/0'))
                        .join(", ")}\n`
                      + `Total: ${totalQty}`;
      const encodedMessage = encodeURIComponent(message);
      setEncodedMessage(encodedMessage);
      setStatus(`Order saved. You can also send via WhatsApp.`);


      // reset quantities
      const reset: Record<string, number> = {};
      skus.forEach((s: any) => { reset[s.size_label] = 0; });
      setQuantities(reset);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-semibold">NEW ORDER</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-sm font-medium">Dealer</label>
          <select className="w-full border rounded p-2" value={dealerId} onChange={e => setDealerId(e.target.value)}>
            <option value="">Select dealer</option>
            {dealers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-sm font-medium">Product</label>
          <select className="w-full border rounded p-2" value={baseId} onChange={e => setBaseId(e.target.value)}>
            <option value="">Select product</option>
            {bases.map(b => <option key={b.id} value={b.id}>{b.base_name}</option>)}
          </select>
        </div>
      </div>

      {skus.length > 0 && (
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">Size</th>
                {skus.map(s => (
                  <th key={s.id} className="w-4 max-w-[4ch] p-3 text-center">
                    {s.size_label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 font-medium">Qty</td>
                {skus.map(s => (
                  <td key={s.id} className="p-2">
                    <input
                      type="number"
                      min={0} max={999}
                      inputMode="numeric"
                      className="w-auto max-w-[4ch] border rounded p-2 text-center"
                      value={quantities[s.size_label] ?? 0}
                      onChange={e => updateQty(s.size_label, parseInt(e.target.value || '0', 10))}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm">Total: <span className="font-semibold">{total}</span></p>
        <button className="bg-black text-white rounded px-4 py-2" onClick={submit}>Save order</button>
        <a href={`https://wa.me/?text=${encodedMessage}`}  target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Send via WhatsApp
        </a>
        <a href={`https://chat.whatsapp.com/GUZtwWJJE3UCPDccb4vqP6/?text=${encodedMessage}`}  target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          GROUP WhatsApp
        </a>
        <a href="#" onClick={(e) => 
                                    {
                                      e.preventDefault();
                                      navigator.clipboard.writeText(decodeURIComponent(encodedMessage)).then(() => {
                                        window.open("https://chat.whatsapp.com/GUZtwWJJE3UCPDccb4vqP6", "_blank");
                                      });
                                    }
                            }
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
          Send to WhatsApp Group (Message copied -&gt; Open Group -&gt; Paste in chat & Send)
          </a>

      </div>

      {status && <p className="text-sm">{status}</p>}
    </div>
  );
}
