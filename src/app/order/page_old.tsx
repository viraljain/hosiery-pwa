// src/app/order/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchProducts, searchDealers } from "@/lib/data";

type Dealer = { id: string; name: string; phone?: string };
type Product = { id: string; base_name: string };
type ItemRow = {base_id?: string; product_name?: string; quantities: Record<string, number>;};

const ADULT_SIZES = ["075/078", "080", "085", "090", "095", "100", "105", "110", "120"];
const KIDS_SIZES = ["035", "040", "045", "050", "055", "060", "065", "070", "075"];

export default function OrderPage() {
  const [dealerQuery, setDealerQuery] = useState("");
  const [dealerOptions, setDealerOptions] = useState<Dealer[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);

  const [adultItems, setAdultItems] = useState<ItemRow[]>([{ quantities: {} }]);
  const [adultProductQuery, setAdultProductQuery] = useState<string[]>([""]);
  const [adultProductOptions, setAdultProductOptions] = useState<Product[][]>([[]]);

  const [kidsItems, setKidsItems] = useState<ItemRow[]>([{ quantities: {} }]);
  const [kidsProductQuery, setKidsProductQuery] = useState<string[]>([""]);
  const [kidsProductOptions, setKidsProductOptions] = useState<Product[][]>([[]]);
  const debounceRef = useRef<number | null>(null);

  const addRow = (category: "adult" | "kids") => {
    if (category === "adult") {
      setAdultItems(prev => [...prev, { quantities: {} }]);
      setAdultProductQuery(prev => [...prev, ""]);
      setAdultProductOptions(prev => [...prev, []]);
    } else {
      setKidsItems(prev => [...prev, { quantities: {} }]);
      setKidsProductQuery(prev => [...prev, ""]);
      setKidsProductOptions(prev => [...prev, []]);
    }    
  };

  const removeRow = (category: "adult" | "kids", idx: number) => {
    if (category === "adult") {
      setAdultItems(prev => prev.filter((_, i) => i !== idx));
      setAdultProductQuery(prev => prev.filter((_, i) => i !== idx));
      setAdultProductOptions(prev => prev.filter((_, i) => i !== idx));
    } else {
      setKidsItems(prev => prev.filter((_, i) => i !== idx));
      setKidsProductQuery(prev => prev.filter((_, i) => i !== idx));
      setKidsProductOptions(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const setQty = (category: "adult" | "kids", idx: number, size: string, val: string) => {
    const v = Number(val || 0);
    if (category === "adult") {
      setAdultItems(prev => {
        const next = [...prev];
        next[idx].quantities[size] = v;
        return next;
      });
    } else {
      setKidsItems(prev => {
        const next = [...prev];
        next[idx].quantities[size] = v;
        return next;
      });
    }
    };


  const selectProduct = (category: "adult" | "kids", idx: number, p: Product) => {
    if (category === "adult") {
      setAdultItems(prev => {
        const next = [...prev];
        next[idx].base_id = p.id;
        next[idx].product_name = p.base_name;
        return next;
      });
    
    setAdultProductQuery(prev => {
      const next = [...prev];
      next[idx] = p.base_name;
      return next;
    });
    setAdultProductOptions(prev => {
      const next = [...prev];
      next[idx] = [];
      return next;
    });
    } else {
      setKidsItems(prev => {
        const next = [...prev];
        next[idx].base_id = p.id;
        next[idx].product_name = p.base_name;
        return next;
      });
      setKidsProductQuery(prev => {
        const next = [...prev];
        next[idx] = p.base_name;
        return next;
      });
      setKidsProductOptions(prev => {
        const next = [...prev];
        next[idx] = [];
        return next;
      });
    }
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
      const queries = [...adultProductQuery];
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
      setAdultProductOptions(results);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [adultProductQuery]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const queries = [...kidsProductQuery];
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
      setKidsProductOptions(results);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [kidsProductQuery]);
  

  const canSave = useMemo(() => {
    if (!selectedDealer?.id) return false;
    return adultItems.every(i => i.base_id && Object.values(i.quantities).some(q => (q ?? 0) > 0)) ||
      kidsItems.every(i => i.base_id && Object.values(i.quantities).some(q => (q ?? 0) > 0));
  }, [adultItems, kidsItems, selectedDealer]);

  const saveOrder = async () => {
    if (!selectedDealer?.id) {
      alert("Select a dealer");
      return;
    }
    const items = [...adultItems, ...kidsItems];
    if (items.length === 0 || !items.some(i => i.base_id && Object.values(i.quantities).some(q => (q ?? 0) > 0))) {
      alert("Add at least one item with quantity");
      return;
    }
    
    const payload = {
      dealer_id: selectedDealer.id,
      items: items.map(i => ({
        base_id: i.base_id,
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
      adultItems: adultItems, kidsItems: kidsItems,
    });
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");

    // reset
    setAdultItems([{ quantities: {} }]);
    setAdultProductQuery([""]);
    setAdultProductOptions([[]]);

    setKidsItems([{ quantities: {} }]);
    setKidsProductQuery([""]);
    setKidsProductOptions([[]]);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Create order</h1>

      {/* Dealer typeahead */}
      <div>
        <label className="text-sm font-medium">Dealer</label>
        <input
          value={selectedDealer?.name ?? dealerQuery}
          onChange={e => {
            setSelectedDealer(null);
            setDealerQuery(e.target.value);
          }}
          placeholder="Type at least 3 letters..."
          className="border px-2 py-1"
        />
        <button
            onClick={saveOrder}
            disabled={!canSave}
            className={`px-4 py-2 rounded text-white ${canSave ? "bg-blue-600" : "bg-gray-400 cursor-not-allowed"}`}
          >
            Save order
          </button>
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
        <div className="flex gap-2">
          Gents/Ladies
          <button onClick={() => addRow("adult")} className="bg-green-600 text-white px-4 py-2 rounded">
            + Add Gents/Ladies Product
          </button>
        </div>
        {adultItems.map((row, idx) => (
          <div key={`adult-${idx}`} className="border rounded p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-2">
                {/* <label className="text-sm font-medium mb-1">Product</label> */}
                <input
                  value={adultProductQuery[idx]}
                  onChange={e => {
                    const v = e.target.value;
                    setAdultItems(prev => {
                      const next = [...prev];
                      // clear selection when user edits
                      next[idx].base_id = undefined;
                      next[idx].product_name = undefined;
                      return next;
                    });
                    setAdultProductQuery(prev => {
                      const next = [...prev];
                      next[idx] = v;
                      return next;
                    });
                  }}
                  placeholder="Type at least 3 letters..."
                  className="border px-2 py-1"
                />
                {row.base_id ? null : (
                  <div className="border mt-1 max-h-40 overflow-y-auto">
                    {adultProductOptions[idx]?.map(p => (
                      <div
                        key={p.id}
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => selectProduct("adult", idx, p)}
                      >
                        {p.base_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeRow("adult", idx)}
                className="text-sm bg-red-600 text-white px-2 py-1 rounded h-9"
              >
                Remove
              </button>
              <div className="flex flex-wrap gap-2">
                {ADULT_SIZES.map(size => (
                  <input
                    key={size}
                    type="number"
                    min={0}
                    max={999}
                    placeholder={size}
                    className="border px-2 py-1 w-auto"
                    onChange={e => setQty("adult", idx, size, e.target.value)}
                  />
                ))}
              </div>
            </div>

            {/* <div>
              <label className="block text-sm font-medium mb-1">Quantities (Gents/Ladies)</label>
              <div className="flex flex-wrap gap-2">
                {ADULT_SIZES.map(size => (
                  <input
                    key={size}
                    type="number"
                    min={0}
                    max={999}
                    placeholder={size}
                    className="border px-2 py-1 w-auto"
                    onChange={e => setQty(idx, size, e.target.value)}
                  />
                ))}
              </div>
            </div> */}
          </div>
        ))}
        <div className="flex gap-2">
          Kids
          <button onClick={() => addRow("kids")} className="bg-green-600 text-white px-4 py-2 rounded">
            + Add Kids Product
          </button>
        </div>
        {kidsItems.map((row, idx) => (
          <div key={`kids-${idx}`} className="border rounded p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-2">
                {/* <label className="text-sm font-medium mb-1">Product</label> */}
                <input
                  value={kidsProductQuery[idx]}
                  onChange={e => {
                    const v = e.target.value;
                    setKidsItems(prev => {
                      const next = [...prev];
                      // clear selection when user edits
                      next[idx].base_id = undefined;
                      next[idx].product_name = undefined;
                      return next;
                    });
                    setKidsProductQuery(prev => {
                      const next = [...prev];
                      next[idx] = v;
                      return next;
                    });
                  }}
                  placeholder="Type at least 3 letters..."
                  className="border px-2 py-1"
                />
                {row.base_id ? null : (
                  <div className="border mt-1 max-h-40 overflow-y-auto">
                    {kidsProductOptions[idx]?.map(p => (
                      <div
                        key={p.id}
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => selectProduct("kids", idx, p)}
                      >
                        {p.base_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeRow("kids", idx)}
                className="text-sm bg-red-600 text-white px-2 py-1 rounded h-9"
              >
                Remove
              </button>
              <div className="flex flex-wrap gap-2">
                {KIDS_SIZES.map(size => (
                  <input
                    key={size}
                    type="number"
                    min={0}
                    max={999}
                    placeholder={size}
                    className="border px-2 py-1 w-auto"
                    onChange={e => setQty("kids", idx, size, e.target.value)}
                  />
                ))}
              </div>
            </div>            
          </div>
        ))}        
      </div>
    </div>
  );
}

function buildWhatsAppMessage({
  orderId,
  dealerName,
  adultItems,
  kidsItems,
}: {
  orderId: string;
  dealerName?: string;
  adultItems: ItemRow[];
  kidsItems: ItemRow[];
}) {
  const header = [dealerName ? `${dealerName}` : null]
    .filter(Boolean)
    .join("\n");
  const adultItemsLines = adultItems
    .filter(i => i.product_name)
    .map(i => {
      const qtys = Object.entries(i.quantities)
        .filter(([, q]) => Number(q) > 0)
        .map(([s, q]) => `${s}/${q}`)
        .join(", ");
      return `${i.product_name}: ${qtys || "—"}`;
    });
  const kidsItemsLines = kidsItems
    .filter(i => i.product_name)
    .map(i => {
      const qtys = Object.entries(i.quantities)
        .filter(([, q]) => Number(q) > 0)
        .map(([s, q]) => `${s}/${q}`)
        .join(", ");
      return `${i.product_name}: ${qtys || "—"}`;
    });
  return `${header}\n${adultItemsLines.join("\n")}\n${kidsItemsLines.join("\n")}`;
}
