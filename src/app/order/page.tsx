// src/app/order/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchProducts, searchDealers } from "@/lib/data";

type Dealer = { id: string; name: string; phone?: string };
type Product = { id: string; base_name: string };
type ItemRow = { base_id?: string; product_name?: string; quantities: Record<string, number> };

const ADULT_SIZES = ["75/78", "80", "85", "90", "95", "100", "105", "110", "120"];
const KIDS_SIZES = ["35", "40", "45", "50", "55", "60", "65", "70", "75"];

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

    // ── Helper functions ────────────────────────────────────────────────
    const addRow = (category: "adult" | "kids") => {
        if (category === "adult") {
            setAdultItems((prev) => [...prev, { quantities: {} }]);
            setAdultProductQuery((prev) => [...prev, ""]);
            setAdultProductOptions((prev) => [...prev, []]);
        } else {
            setKidsItems((prev) => [...prev, { quantities: {} }]);
            setKidsProductQuery((prev) => [...prev, ""]);
            setKidsProductOptions((prev) => [...prev, []]);
        }
    };

    const removeRow = (category: "adult" | "kids", idx: number) => {
        if (category === "adult") {
            setAdultItems((prev) => prev.filter((_, i) => i !== idx));
            setAdultProductQuery((prev) => prev.filter((_, i) => i !== idx));
            setAdultProductOptions((prev) => prev.filter((_, i) => i !== idx));
        } else {
            setKidsItems((prev) => prev.filter((_, i) => i !== idx));
            setKidsProductQuery((prev) => prev.filter((_, i) => i !== idx));
            setKidsProductOptions((prev) => prev.filter((_, i) => i !== idx));
        }
    };

    const setQty = (category: "adult" | "kids", idx: number, size: string, val: string) => {
        const v = Number(val) || 0;
        const setter = category === "adult" ? setAdultItems : setKidsItems;

        setter((prev) => {
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                quantities: { ...next[idx].quantities, [size]: v },
            };
            return next;
        });
    };

    const selectProduct = (category: "adult" | "kids", idx: number, p: Product) => {
        const setterItems = category === "adult" ? setAdultItems : setKidsItems;
        const setterQuery = category === "adult" ? setAdultProductQuery : setKidsProductQuery;
        const setterOptions = category === "adult" ? setAdultProductOptions : setKidsProductOptions;

        setterItems((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], base_id: p.id, product_name: p.base_name };
            return next;
        });

        setterQuery((prev) => {
            const next = [...prev];
            next[idx] = p.base_name;
            return next;
        });

        setterOptions((prev) => {
            const next = [...prev];
            next[idx] = [];
            return next;
        });
    };

    // ── Debounced searches ──────────────────────────────────────────────
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = window.setTimeout(async () => {
            if (dealerQuery.trim().length < 3) {
                setDealerOptions([]);
                return;
            }
            try {
                const res = await searchDealers(dealerQuery.trim());
                setDealerOptions(res ?? []);
            } catch {
                setDealerOptions([]);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [dealerQuery]);

    // Product search for adults & kids (combined logic could be extracted later)
    useEffect(() => {
        const timer = setTimeout(async () => {
            // Adult products
            const adultResults = await Promise.all(
                adultProductQuery.map(async (q) => {
                    if ((q ?? "").trim().length < 3) return [];
                    try {
                        return (await searchProducts(q.trim())) ?? [];
                    } catch {
                        return [];
                    }
                })
            );
            setAdultProductOptions(adultResults);

            // Kids products
            const kidsResults = await Promise.all(
                kidsProductQuery.map(async (q) => {
                    if ((q ?? "").trim().length < 3) return [];
                    try {
                        return (await searchProducts(q.trim())) ?? [];
                    } catch {
                        return [];
                    }
                })
            );
            setKidsProductOptions(kidsResults);
        }, 300);

        return () => clearTimeout(timer);
    }, [adultProductQuery, kidsProductQuery]);

    // ── UI & Save logic ─────────────────────────────────────────────────
    const canSave = useMemo(() => {
        if (!selectedDealer?.id) return false;

        const hasValidAdult = adultItems.some(
            (i) => i.base_id && Object.values(i.quantities).some((q) => q > 0)
        );
        const hasValidKids = kidsItems.some(
            (i) => i.base_id && Object.values(i.quantities).some((q) => q > 0)
        );

        return hasValidAdult || hasValidKids;
    }, [adultItems, kidsItems, selectedDealer]);

    const saveOrder = async () => {
        // ... your existing save logic ...
        // (keeping it the same, just not repeating here)
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">Create New Order</h1>

                    <button
                        onClick={saveOrder}
                        disabled={!canSave}
                        className={`
              px-6 py-2.5 rounded-lg font-medium text-white shadow-sm
              transition-colors
              ${canSave
                                ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                                : "bg-gray-400 cursor-not-allowed"}
            `}
                    >
                        Save & Send WhatsApp
                    </button>
                </div>

                {/* DEALER SECTION */}
                <div className="mb-10 bg-white shadow rounded-xl p-6 border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dealer
                    </label>
                    <input
                        value={selectedDealer?.name ?? dealerQuery}
                        onChange={(e) => {
                            setSelectedDealer(null);
                            setDealerQuery(e.target.value);
                        }}
                        placeholder="Search dealer (min 3 characters)..."
                        className="w-full md:w-96 px-4 py-2.5 border border-gray-300 rounded-lg 
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />

                    {selectedDealer ? null : (
                        <div className="mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-sm">
                            {dealerOptions.length === 0 && dealerQuery.length >= 3 && (
                                <div className="px-4 py-3 text-sm text-gray-500">No dealers found</div>
                            )}
                            {dealerOptions.map((d) => (
                                <div
                                    key={d.id}
                                    className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors"
                                    onClick={() => setSelectedDealer(d)}
                                >
                                    {d.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* PRODUCTS SECTIONS */}
                <div className="space-y-10">
                    {/* ── ADULTS ──────────────────────────────────────────────── */}
                    <section className="bg-white shadow rounded-xl p-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-semibold text-gray-800">Gents / Ladies</h2>
                            <button
                                onClick={() => addRow("adult")}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg 
                         hover:bg-green-700 transition-colors font-medium"
                            >
                                + Add Product
                            </button>
                        </div>

                        {adultItems.map((row, idx) => (
                            <div
                                key={`adult-${idx}`}
                                className="mb-6 last:mb-0 p-5 border border-gray-200 rounded-lg bg-gray-50"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
                                    <div className="flex-1 min-w-0">
                                        <input
                                            value={adultProductQuery[idx] ?? ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setAdultItems((prev) => {
                                                    const next = [...prev];
                                                    next[idx] = { ...next[idx], base_id: undefined, product_name: undefined };
                                                    return next;
                                                });
                                                setAdultProductQuery((prev) => {
                                                    const next = [...prev];
                                                    next[idx] = val;
                                                    return next;
                                                });
                                            }}
                                            placeholder="Search product (min 3 chars)..."
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />

                                        {!row.base_id && adultProductOptions[idx]?.length > 0 && (
                                            <div className="mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-sm">
                                                {adultProductOptions[idx].map((p) => (
                                                    <div
                                                        key={p.id}
                                                        className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors"
                                                        onClick={() => selectProduct("adult", idx, p)}
                                                    >
                                                        {p.base_name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* <button
                                        onClick={() => removeRow("adult", idx)}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                                    >
                                        Remove
                                    </button> */}
                                </div>

                                {/* SIZE HEADERS + INPUTS */}
                                {/* <div className="overflow-x-auto">
                  <div className="inline-grid grid-flow-col gap-3 min-w-max">
                    {ADULT_SIZES.map((size) => (
                      <div key={size} className="text-center min-w-[20px]">
                        <div className="text-xs font-medium text-gray-600 mb-1.5">{size}</div>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={row.quantities[size] ?? ""}
                          onChange={(e) => setQty("adult", idx, size, e.target.value)}
                          className="w-full px-2 py-1.5 text-center border border-gray-300 rounded-md 
                                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div> */}
                                <div className="overflow-x-auto pb-2">
                                    <div className="inline-flex gap-1">
                                        <button
          onClick={() => {
            if (window.confirm(`Remove this product (${row.product_name || "unsaved"})?`)) {
              removeRow("adult", idx);
            }
          }}
          className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap text-sm font-medium shadow-sm"
          title="Remove this product row"
        >X</button>
                                        {ADULT_SIZES.map((size) => (
                                            <div key={size} className="flex flex-col items-center w-3">
                                                <span className="text-[12px] font-medium text-gray-500 mb-0.5">
                                                    {size}
                                                </span>
                                                
                                                <input
                                                    type="number"
                                                    value={row.quantities[size] ?? ""}
                                                    onChange={(e) => setQty("adult", idx, size, e.target.value)}
                                                    className="w-auto h-3 max-w-[4ch] text-center
                                                                border border-gray-300 rounded-md
                                                                focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                                                                // [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
                                                                // [&::-webkit-inner-spin-button]:appearance-none
                                                            "
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>

                    {/* ── KIDS ────────────────────────────────────────────────── */}
                    <section className="bg-white shadow rounded-xl p-6 border border-gray-200">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-xl font-semibold text-gray-800">Kids</h2>
                            <button
                                onClick={() => addRow("kids")}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg 
                         hover:bg-green-700 transition-colors font-medium"
                            >
                                + Add Product
                            </button>
                        </div>

                        {kidsItems.map((row, idx) => (
                            <div
                                key={`kids-${idx}`}
                                className="mb-6 last:mb-0 p-5 border border-gray-200 rounded-lg bg-gray-50"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-5">
                                    <div className="flex-1 min-w-0">
                                        <input
                                            value={kidsProductQuery[idx] ?? ""}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setKidsItems((prev) => {
                                                    const next = [...prev];
                                                    next[idx] = { ...next[idx], base_id: undefined, product_name: undefined };
                                                    return next;
                                                });
                                                setKidsProductQuery((prev) => {
                                                    const next = [...prev];
                                                    next[idx] = val;
                                                    return next;
                                                });
                                            }}
                                            placeholder="Search product (min 3 chars)..."
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg 
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />

                                        {!row.base_id && kidsProductOptions[idx]?.length > 0 && (
                                            <div className="mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-sm">
                                                {kidsProductOptions[idx].map((p) => (
                                                    <div
                                                        key={p.id}
                                                        className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer transition-colors"
                                                        onClick={() => selectProduct("kids", idx, p)}
                                                    >
                                                        {p.base_name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    
                                </div>

                                {/* SIZE HEADERS + INPUTS */}
                                <div className="overflow-x-auto">
                                    
                                    <div className="inline-grid grid-flow-col gap-3 min-w-max">
                                        <button
                                        // onClick={() => removeRow("kids", idx)}
                                        // className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                                        onClick={() => {
            if (window.confirm(`Remove this product (${row.product_name || "unsaved"})?`)) {
              removeRow("kids", idx);
            }
          }}
          className="px-2 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap text-sm font-medium shadow-sm"
          title="Remove this product row"
                                    >X</button>
                                        {KIDS_SIZES.map((size) => (
                                            <div key={size} className="text-center min-w-[10px]">
                                                <div className="text-[12px] text-gray-600 mb-1.5">{size}</div>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={999}
                                                    value={row.quantities[size] ?? ""}
                                                    onChange={(e) => setQty("kids", idx, size, e.target.value)}
                                                    className="w-auto max-w-[4ch] px-0.25 py-1.5 text-center 
                          border border-gray-300 rounded-md 
                                   focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                // className="w-auto max-w-[4ch] border rounded p-2 text-center"
                                                //border border-gray-300 rounded-md
                                                // focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                </div>
            </div>
        </div>
    );
}