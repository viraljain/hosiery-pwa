"use client";
import { useState } from "react";

type Product = {
  id: string;
  base_name: string;
};

type Props = {
  products: Product[];
};

export default function OrderForm({ products }: Props) {
  const [items, setItems] = useState([{ productId: "", quantities: {} as Record<string, number> }]);

  const selectedProducts = items.map(i => i.productId);

  const addItem = () => setItems(prev => [...prev, { productId: "", quantities: {} }]);

  const updateQty = (idx: number, size: string, value: string) => {
    const newItems = [...items];
    newItems[idx].quantities[size] = Number(value || 0);
    setItems(newItems);
  };

  const updateProduct = (idx: number, productId: string) => {
    const newItems = [...items];
    newItems[idx].productId = productId;
    setItems(newItems);
  };

  const submitOrder = async () => {
    const payload = { items };
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.error || "failed to save"}`);
      return;
    }
    alert(`Order saved! ID: ${data.order_id}`);
    setItems([{ productId: "", quantities: {} }]);
  };

  const adultSizes = ["090", "095", "100", "105", "110"];

  return (
    <div className="p-4 space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="border p-4 rounded">
          <label className="block text-sm font-medium mb-1">Product</label>
          <select
            value={item.productId}
            onChange={e => updateProduct(idx, e.target.value)}
            className="border px-2 py-1 mb-3 w-full"
          >
            <option value="">Select product</option>
            {products.map(p => (
              <option key={p.id} value={p.id} disabled={selectedProducts.includes(p.id)}>
                {p.base_name}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium mb-1">Quantities (Adults)</label>
          <div className="flex flex-wrap gap-2">
            {adultSizes.map(size => (
              <input
                key={size}
                type="number"
                placeholder={size}
                min={0}
                className="border px-2 py-1 w-20"
                onChange={e => updateQty(idx, size, e.target.value)}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <button onClick={addItem} className="bg-green-600 text-white px-4 py-2 rounded">
          + Add product
        </button>
        <button onClick={submitOrder} className="bg-blue-600 text-white px-4 py-2 rounded">
          Save Order
        </button>
      </div>
    </div>
  );
}
