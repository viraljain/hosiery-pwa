'use client';
import { useState } from 'react';

export default function SqlExportPage() {
  const [status, setStatus] = useState('');

  async function handleExport() {
    const order = {
        DealerCode: 101,
        DealerName: 'Test Customer',
    //   Remarks: [{ sku: 'ABC', qty: 2 }],
        Remarks: 'Scheme: Folding Stool - 4 Pcs',
        TotalItemQty: 64
    };

    const res = await fetch('/api/sgm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });

    const data = await res.json();
    setStatus(data.message || data.error);
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">SGM Export Test</h1>
      <button
        onClick={handleExport}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Export Sample Order
      </button>
      <p className="mt-2 text-gray-700">{status}</p>
    </div>
  );
}
