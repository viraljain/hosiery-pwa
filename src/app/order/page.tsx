// src/app/order/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchProducts, searchDealers } from "@/lib/data";

type Dealer = { id: string; name: string; phone?: string };
type Product = { id: string; base_name: string };

type ItemRow = {
  base_id?: string;
  product_name?: string;
  quantities: Record<string, number>;
};

const ADULT_SIZES = ["090", "095", "100", "105", "110"];

export default function OrderPage() {
  const [dealerQuery, setDealerQuery] = useState("");
  const [dealerOptions, setDealerOptions] = useState<Dealer[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);

  const [items, setItems] = useState<ItemRow[]>([{ quantities: {} }]);
  const [productQuery, setProductQuery] = useState<string[]>([""]);
  const [productOptions, setProductOptions] = useState<Product[][]>([[]]);
  const debounceRef = useRef<number | null>(null);

  const addRow = () => {
    setItems(prev => [...prev, { quantities: {} }]);
    setProductQuery(prev => [...prev, ""]);
    setProductOptions(prev => [...prev, []]);
  };

  const removeRow = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
    setProductQuery(prev => prev.filter((_, i) => i !== idx));
    setProductOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const setQty = (idx: number, size: string, val: string) => {
    const v = Number(val || 0);
    setItems(prev => {
      const next = [...prev];
      next[idx].quantities[size] = v;
      return next;
    });
  };

  const selectProduct = (idx: number, p: Product) => {
    setItems(prev => {
      const next = [...prev];
      next[idx].base_id = p.id;
      next[idx].product_name = p.base_name;
      return next;
    });
    setProductQuery(prev => {
      const next = [...prev];
      next[idx] = p.base_name;
      return next;
    });
    setProductOptions(prev => {
      const next = [...prev];
      next[idx] = [];
      return next;
    });
  };

  // Dealer typeahead (server-side search)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      if (dealerQuery.trim().length < 3) {
        setDealerOptions([]);
        return;
      }
      try {
        const res = await searchDealers(dealerQuery.trim());
        setDealerOptions(res as any);
      } catch {
        setDealerOptions([]);
      }
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [dealerQuery]);

  // Product typeahead per row (server-side search)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const queries = [...productQuery];
      const results: Product[][] = [];
      for (const q of queries) {
        if ((q ?? "").trim().length < 3) {
          results.push([]);
          continue;
        }
        try {
          const r = await searchProducts(q.trim());
          results.push(r as any);
        } catch {
          results.push([]);
        }
      }
      setProductOptions(results);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [productQuery]);

  const canSave = useMemo(() => {
    if (!selectedDealer?.id) return false;
    return items.every(i => i.product_id && Object.values(i.quantities).some(q => (q ?? 0) > 0));
  }, [items, selectedDealer]);

  const saveOrder = async () => {
    if (!selectedDealer?.id) {
      alert("Select a dealer");
      return;
    }
    const payload = {
      dealer_id: selectedDealer.id,
      items: items.map(i => ({
        product_id: i.product_id,
        quantities: Object.fromEntries(
          Object.entries(i.quantities).filter(([, q]) => Number(q) > 0)
        ),
      })),
    };
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Error: ${data.error || "Failed to save"}`);
      return;
    }

    // Build WhatsApp message and open deep link
    const message = buildWhatsAppMessage({
      orderId: data.order_id,
      dealerName: selectedDealer.name,
      items,
    });
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");

    // reset
    setItems([{ quantities: {} }]);
    setProductQuery([""]);
    setProductOptions([[]]);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Create order (Adults)</h1>

      {/* Dealer typeahead */}
      <div>
        <label className="block text-sm font-medium mb-1">Dealer</label>
        <input
          value={selectedDealer?.name ?? dealerQuery}
          onChange={e => {
            setSelectedDealer(null);
            setDealerQuery(e.target.value);
          }}
          placeholder="Type at least 3 letters..."
          className="border px-2 py-1 w-full"
        />
        {selectedDealer ? null : (
          <div className="border mt-1 max-h-40 overflow-y-auto">
            {dealerOptions.map(d => (
              <div
                key={d.id}
                className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                onClick={() => setSelectedDealer(d)}
              >
                {d.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="space-y-4">
        {items.map((row, idx) => (
          <div key={idx} className="border rounded p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Product</label>
                <input
                  value={productQuery[idx]}
                  onChange={e => {
                    const v = e.target.value;
                    setItems(prev => {
                      const next = [...prev];
                      // clear selection when user edits
                      next[idx].product_id = undefined;
                      next[idx].product_name = undefined;
                      return next;
                    });
                    setProductQuery(prev => {
                      const next = [...prev];
                      next[idx] = v;
                      return next;
                    });
                  }}
                  placeholder="Type at least 3 letters..."
                  className="border px-2 py-1 w-full"
                />
                {row.product_id ? null : (
                  <div className="border mt-1 max-h-40 overflow-y-auto">
                    {productOptions[idx]?.map(p => (
                      <div
                        key={p.id}
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => selectProduct(idx, p)}
                      >
                        {p.base_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeRow(idx)}
                className="text-sm bg-red-600 text-white px-2 py-1 rounded h-9"
              >
                Remove
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Quantities (Adults)</label>
              <div className="flex flex-wrap gap-2">
                {ADULT_SIZES.map(size => (
                  <input
                    key={size}
                    type="number"
                    min={0}
                    placeholder={size}
                    className="border px-2 py-1 w-20"
                    onChange={e => setQty(idx, size, e.target.value)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <button onClick={addRow} className="bg-green-600 text-white px-4 py-2 rounded">
            + Add product
          </button>
          <button
            onClick={saveOrder}
            disabled={!canSave}
            className={`px-4 py-2 rounded text-white ${canSave ? "bg-blue-600" : "bg-gray-400 cursor-not-allowed"}`}
          >
            Save order
          </button>
        </div>
      </div>
    </div>
  );
}

function buildWhatsAppMessage({
  orderId,
  dealerName,
  items,
}: {
  orderId: string;
  dealerName?: string;
  items: ItemRow[];
}) {
  const header = [`Order ID: ${orderId}`, dealerName ? `Dealer: ${dealerName}` : null]
    .filter(Boolean)
    .join("\n");
  const lines = items
    .filter(i => i.product_name)
    .map(i => {
      const qtys = Object.entries(i.quantities)
        .filter(([, q]) => Number(q) > 0)
        .map(([s, q]) => `${s}=${q}`)
        .join(", ");
      return `- ${i.product_name}: ${qtys || "—"}`;
    });
  return `${header}\n\nProducts:\n${lines.join("\n")}`;
}
