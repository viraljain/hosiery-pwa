// src/app/order/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchProducts, searchDealers, getOrderbyId, getOrdersMatrix } from "@/lib/data";
import React from "react";

type Dealer = { id: string; name: string; phone?: string; city?: string };
type Product = { id: string; base_name: string; base_name_nick?: string };
type ItemRow = {
    index: number;
    base_id?: string;
    product_name?: string;
    product_name_nick?: string;
    quantities: Record<string, number>;
    price?: number;
};
type ActiveProductSearch = { category: "adult" | "kids"; idx: number } | null;

const ADULT_SIZES = ["77", "80", "85", "90", "95", "100", "105", "110", "120"];
const KIDS_SIZES = ["35", "40", "45", "50", "55", "60", "65", "70", "75"];
const FREQUENT_PRODUCTS_STORAGE_KEY = "order_page_frequent_products_v1";

function getProductDisplayName(p: { base_name?: string; base_name_nick?: string }): string {
    return (p.base_name_nick && p.base_name_nick.trim().length > 0)
        ? p.base_name_nick
        : (p.base_name ?? "");
}

export default function OrderPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
    const [dealerQuery, setDealerQuery] = useState("");
    const [dealerOptions, setDealerOptions] = useState<Dealer[]>([]);
    const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);

    const [adultItems, setAdultItems] = useState<ItemRow[]>([{ quantities: {}, index: 0 }]);
    const [adultProductQuery, setAdultProductQuery] = useState<string[]>([""]);
    const [adultProductOptions, setAdultProductOptions] = useState<Product[][]>([[]]);

    const [kidsItems, setKidsItems] = useState<ItemRow[]>([{ quantities: {}, index: 0 }]);
    const [kidsProductQuery, setKidsProductQuery] = useState<string[]>([""]);
    const [kidsProductOptions, setKidsProductOptions] = useState<Product[][]>([[]]);

    // Full-screen product search modal state
    const [activeProductSearch, setActiveProductSearch] = useState<ActiveProductSearch>(null);
    const [frequentProducts, setFrequentProducts] = useState<Product[]>([]);
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);

    const [narration, setNarration] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const debounceRef = useRef<number | null>(null);
    const modalInputRef = useRef<HTMLInputElement | null>(null);

    const orderId = React.use(searchParams).orderId;
    const isModify = !!orderId;

    // ── Load / record frequently used products ─────────────────────────
    const recordFrequentProduct = (p: Product) => {
        if (!p?.id) return;
        setFrequentProducts((prev) => {
            try {
                const raw = localStorage.getItem(FREQUENT_PRODUCTS_STORAGE_KEY);
                const stored: Array<{ product: Product; count: number; lastUsed: number }> = raw
                    ? JSON.parse(raw)
                    : [];

                const existingIdx = stored.findIndex((entry) => entry.product.id === p.id);
                if (existingIdx >= 0) {
                    stored[existingIdx] = {
                        product: { ...stored[existingIdx].product, ...p },
                        count: stored[existingIdx].count + 1,
                        lastUsed: Date.now(),
                    };
                } else {
                    stored.push({ product: p, count: 1, lastUsed: Date.now() });
                }

                stored.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
                const trimmed = stored.slice(0, 30);
                localStorage.setItem(FREQUENT_PRODUCTS_STORAGE_KEY, JSON.stringify(trimmed));
                return trimmed.map((entry) => entry.product);
            } catch {
                const deduped = [p, ...prev.filter((item) => item.id !== p.id)].slice(0, 12);
                return deduped;
            }
        });
    };

    useEffect(() => {
        let cancelled = false;

        async function loadFrequent() {
            try {
                const raw = localStorage.getItem(FREQUENT_PRODUCTS_STORAGE_KEY);
                if (raw) {
                    const parsed: Array<{ product: Product; count: number; lastUsed: number }> = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        parsed.sort((a, b) => b.count - a.count || b.lastUsed - a.lastUsed);
                        if (!cancelled) {
                            setFrequentProducts(parsed.map((e) => e.product));
                        }
                        return;
                    }
                }
            } catch {
                // Ignore storage parse issues and fall back to recent orders
            }

            // Fallback: derive top products from recent orders_matrix rows if localStorage is empty
            try {
                const { data } = await getOrdersMatrix();
                if (cancelled || !Array.isArray(data)) return;

                const counts = new Map<string, { product: Product; count: number }>();
                for (const row of data) {
                    const baseObj = Array.isArray(row.base) ? row.base[0] : row.base;
                    if (baseObj?.id && baseObj?.base_name) {
                        const current = counts.get(baseObj.id);
                        counts.set(baseObj.id, {
                            product: {
                                id: baseObj.id,
                                base_name: baseObj.base_name,
                                base_name_nick: baseObj.base_name_nick ?? undefined,
                            },
                            count: (current?.count ?? 0) + 1,
                        });
                    }
                }

                const topFromOrders = Array.from(counts.values())
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 12)
                    .map((entry) => entry.product);

                if (!cancelled && topFromOrders.length > 0) {
                    setFrequentProducts(topFromOrders);
                }
            } catch {
                // Leave empty if offline or unauthorized
            }
        }

        loadFrequent();
        return () => {
            cancelled = true;
        };
    }, []);

    // Focus the overlay search box & support Escape to close
    useEffect(() => {
        if (!activeProductSearch) return;
        const focusTimer = window.setTimeout(() => {
            modalInputRef.current?.focus();
        }, 0);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setActiveProductSearch(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [activeProductSearch]);

    // ── Helper functions ────────────────────────────────────────────────
    const addRow = (category: "adult" | "kids") => {
        if (category === "adult") {
            setAdultItems((prev) => [...prev, { quantities: {}, index: prev.length }]);
            setAdultProductQuery((prev) => [...prev, ""]);
            setAdultProductOptions((prev) => [...prev, []]);
        } else {
            setKidsItems((prev) => [...prev, { quantities: {}, index: prev.length }]);
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

    const setPrice = (category: "adult" | "kids", idx: number, val: string) => {
        const v = Number(val) || 0;
        const setter = category === "adult" ? setAdultItems : setKidsItems;

        setter((prev) => {
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                price: v,
            };
            return next;
        });
    };

    const setQty = (category: "adult" | "kids", idx: number, size: string, val: string) => {
        const v = Number(val) || 0;
        const setter = category === "adult" ? setAdultItems : setKidsItems;

        setter((prev) => {
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                quantities: { ...next[idx].quantities, [size]: v },
                index: idx,
            };
            return next;
        });
    };

    const getRowTotal = (quantities: Record<string, number>) =>
        Object.values(quantities || 0).reduce((sum, q) => sum + (Number(q) || 0), 0);

    const grandTotal = useMemo(() => {
        const adultSum = adultItems.reduce((sum, row) => {
            if (!row || !row.quantities) return sum;
            return sum + getRowTotal(row.quantities || 0);
        }, 0);
        const kidsSum = kidsItems.reduce((sum, row) => {
            if (!row || !row.quantities) return sum;
            return sum + getRowTotal(row.quantities || 0);
        }, 0);
        return adultSum + kidsSum;
    }, [adultItems, kidsItems]);

    const handleProductQueryChange = (category: "adult" | "kids", idx: number, val: string) => {
        const setterItems = category === "adult" ? setAdultItems : setKidsItems;
        const setterQuery = category === "adult" ? setAdultProductQuery : setKidsProductQuery;

        setterItems((prev) => {
            const next = [...prev];
            if (next[idx]) {
                next[idx] = { ...next[idx], base_id: undefined, product_name: undefined, product_name_nick: undefined };
            }
            return next;
        });
        setterQuery((prev) => {
            const next = [...prev];
            next[idx] = val;
            return next;
        });
    };

    const selectProduct = (category: "adult" | "kids", idx: number, p: Product) => {
        const setterItems = category === "adult" ? setAdultItems : setKidsItems;
        const setterQuery = category === "adult" ? setAdultProductQuery : setKidsProductQuery;
        const setterOptions = category === "adult" ? setAdultProductOptions : setKidsProductOptions;

        setterItems((prev) => {
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                base_id: p.id,
                product_name: p.base_name,
                product_name_nick: p.base_name_nick,
            };
            return next;
        });

        setterQuery((prev) => {
            const next = [...prev];
            next[idx] = p.base_name_nick ? p.base_name_nick : p.base_name;
            return next;
        });

        setterOptions((prev) => {
            const next = [...prev];
            next[idx] = [];
            return next;
        });

        recordFrequentProduct(p);
        setActiveProductSearch(null);
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

    // Load existing order details if orderId is present in query params
    const firstLoadRef = useRef(false);
    useEffect(() => {
        if (firstLoadRef.current) return;
        firstLoadRef.current = true;
        if (isModify) {
            getOrderbyId(orderId as string).then(({ data, error }) => {
                if (error) {
                    alert("Error fetching order details: " + error.message);
                    return;
                }
                if (data) {
                    if (data.length > 0) {
                        const order = data[0];
                        setSelectedDealer(Array.isArray(order.dealer) ? order.dealer[0] : order.dealer);
                        setNarration(order.narration || "");
                        removeRow("adult", 0);
                        removeRow("kids", 0);

                        let index_adult = 0,
                            index_kids = 0;

                        for (let index = 0; index < data.length; index++) {
                            const element = data[index];
                            const adult = Object.keys(element.quantities).some((k: string) => ADULT_SIZES.includes(k));
                            const kids = Object.keys(element.quantities || 0).some((k: string) => KIDS_SIZES.includes(k));
                            if (adult) {
                                addRow("adult");
                                selectProduct(
                                    "adult",
                                    index_adult,
                                    Array.isArray(element.base) ? element.base[index] : element.base
                                );
                                setPrice("adult", index_adult, String(element.price));
                                for (const [size, qty] of Object.entries(element.quantities)) {
                                    setQty("adult", index_adult, size, String(qty));
                                }
                                index_adult++;
                            }
                            if (kids) {
                                addRow("kids");
                                selectProduct(
                                    "kids",
                                    index_kids,
                                    Array.isArray(element.base) ? element.base[index] : element.base
                                );
                                setPrice("kids", index_kids, String(element.price));
                                for (const [size, qty] of Object.entries(element.quantities)) {
                                    setQty("kids", index_kids, size, String(qty));
                                }
                                index_kids++;
                            }
                        }
                    } else {
                        alert("No order details found for orderId: " + orderId);
                    }
                }
            });
        }
    }, [orderId]);

    // Product search for adults & kids
    useEffect(() => {
        const timer = setTimeout(async () => {
            setIsSearchingProducts(true);
            try {
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
            } finally {
                setIsSearchingProducts(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [adultProductQuery, kidsProductQuery]);

    const [canWhatsApp, setCanWhatsApp] = useState<boolean>(false);

    const canSave = useMemo(() => {
        if (!selectedDealer?.id) return false;
        if (canWhatsApp) return false;
        const hasValidAdult = adultItems.some((i) => {
            if (!i) return false;
            return i.base_id && Object.values(i.quantities).some((q) => q > 0);
        });
        const hasValidKids = kidsItems.some((i) => {
            if (!i) return false;
            return i.base_id && Object.values(i.quantities).some((q) => q > 0);
        });
        return hasValidAdult || hasValidKids;
    }, [adultItems, kidsItems, selectedDealer, canWhatsApp]);

    const [message, setMessage] = useState<string>("");

    const saveOrder = async () => {
        if (isSubmitting) return;
        if (!selectedDealer?.id) {
            alert("Select a dealer");
            return;
        }
        const items = [...adultItems, ...kidsItems];
        if (items.length === 0 || !items.some((i) => i.base_id && Object.values(i.quantities).some((q) => (q ?? 0) > 0))) {
            alert("Add at least one item with quantity");
            return;
        }

        setIsSubmitting(true);

        const payload = {
            pl_order_id: isModify ? orderId : "",
            pl_dealer_id: selectedDealer.id,
            pl_items: items.map((i) => ({
                index: i.index,
                base_id: i.base_id,
                price: typeof i.price === "number" ? i.price : 0,
                quantities: Object.fromEntries(
                    Object.entries(i.quantities).filter(([, q]) => Number(q) > 0)
                ),
            })),
            pl_narration: narration,
        };
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
            setIsSubmitting(false);
            alert(`Error: ${data.error || "Failed to save"}`);
            return;
        }

        const message1 = buildWhatsAppMessage({
            orderId: data.order_id,
            dealerName: selectedDealer.name,
            adultItems: adultItems,
            kidsItems: kidsItems,
            narration: narration,
        });
        setMessage(message1);
        setCanWhatsApp(true);

        alert("Order saved successfully" + "\n\n" + message1);

        window.confirm("Order saved successfully. Do you want to start a new order? Press CANCEL to send WhatsApp.") &&
            newOrder();
    };

    const newOrder = async () => {
        if (window.confirm("Are you sure you want to start a new order? This will clear the current order details.")) {
            setSelectedDealer(null);
            setNarration("");
            setDealerQuery("");
            setDealerOptions([]);
            setActiveProductSearch(null);

            setIsSubmitting(false);
            setCanWhatsApp(false);

            setAdultItems([{ quantities: {}, index: 0 }]);
            setAdultProductQuery([""]);
            setAdultProductOptions([[]]);

            setKidsItems([{ quantities: {}, index: 0 }]);
            setKidsProductQuery([""]);
            setKidsProductOptions([[]]);
        }
    };

    function buildWhatsAppMessage({
        orderId,
        dealerName,
        adultItems,
        kidsItems,
        narration,
    }: {
        orderId: string;
        dealerName?: string;
        adultItems: ItemRow[];
        kidsItems: ItemRow[];
        narration?: string;
    }) {
        const header = [dealerName ? `${dealerName}` : null].filter(Boolean).join("\n");

        const adultItemsLines = adultItems
            .filter((i) => i.product_name)
            .map((i) => {
                const qtys = Object.entries(i.quantities)
                    .filter(([, q]) => Number(q) > 0)
                    .map(([s, q]) => `${s}/${q}`)
                    .join(", ");
                return `${(i.product_name_nick ?? "").length > 0 ? i.product_name_nick : i.product_name}${Number(i.price) > 0 ? "(" + i.price + ")" : ""}: ${qtys || "—"}`;
            })
            .join("\n")
            .replaceAll(/MAESTRO/gi, "M.")
            .replaceAll(/DIVYA/gi, "D.")
            .replaceAll(/PLATINUM/gi, "P.")
            .replaceAll(/RN/gi, "RN")
            .replaceAll(/RNS/gi, "RNS")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());

        const kidsItemsLines = kidsItems
            .filter((i) => i.product_name)
            .map((i) => {
                const qtys = Object.entries(i.quantities)
                    .filter(([, q]) => Number(q) > 0)
                    .map(([s, q]) => `${s}/${q}`)
                    .join(", ");
                return `${(i.product_name_nick ?? "").length > 0 ? i.product_name_nick : i.product_name}${Number(i.price) > 0 ? "(" + i.price + ")" : ""}: ${qtys || "—"}`;
            })
            .join("\n")
            .replaceAll(/MAESTRO/gi, "M.")
            .replaceAll(/DIVYA/gi, "D.")
            .replaceAll(/PLATINUM/gi, "P.")
            .replaceAll(/RN/gi, "RN")
            .replaceAll(/RNS/gi, "RNS")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase());

        return `${header}\n${adultItemsLines}\n${kidsItemsLines}\n${narration ? "Note: " + narration : ""}`;
    }

    // Derived values for the active full-screen product search overlay
    const activeQuery = activeProductSearch
        ? activeProductSearch.category === "adult"
            ? adultProductQuery[activeProductSearch.idx] ?? ""
            : kidsProductQuery[activeProductSearch.idx] ?? ""
        : "";

    const activeSearchResults = activeProductSearch
        ? activeProductSearch.category === "adult"
            ? adultProductOptions[activeProductSearch.idx] ?? []
            : kidsProductOptions[activeProductSearch.idx] ?? []
        : [];

    const isEmptyQuery = activeQuery.trim().length === 0;
    const tilesToRender = isEmptyQuery ? frequentProducts : activeSearchResults;

    return (
        <div className="min-h-screen bg-gray-50 py-1 px-1.5 sm:px-2 lg:px-3">
            {/* FULL-SCREEN PRODUCT SEARCH OVERLAY */}
            {activeProductSearch && (
                <div
                    className="fixed inset-0 z-50 flex flex-col bg-gray-400/30 backdrop-blur p-2 sm:p-4"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) {
                            setActiveProductSearch(null);
                        }
                    }}
                >
                    <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-transparent shadow-2xl border border-slate-200">
                        {/* Sticky Top Search Bar */}
                        <div className="border-b border-slate-200 bg-orange-500/75 p-3 sm:p-4">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                                            activeProductSearch.category === "adult"
                                                ? "bg-orange-100 text-orange-800"
                                                : "bg-green-100 text-green-800"
                                        }`}
                                    >
                                        {activeProductSearch.category === "adult"
                                            ? `Gents / Ladies #${activeProductSearch.idx + 1}`
                                            : `Kids #${activeProductSearch.idx + 1}`}
                                    </span>
                                    <span className="text-sm font-semibold text-slate-700">
                                        {isEmptyQuery ? "Frequently Used Products" : "Search Results"}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setActiveProductSearch(null)}
                                    className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-300 transition-colors"
                                >
                                    ✕ Close (Esc)
                                </button>
                            </div>

                            <div className="relative flex items-center gap-2 bg-transparent">
                                <input
                                    ref={modalInputRef}
                                    type="text"
                                    value={activeQuery}
                                    onChange={(e) =>
                                        handleProductQueryChange(
                                            activeProductSearch.category,
                                            activeProductSearch.idx,
                                            e.target.value
                                        )
                                    }
                                    placeholder={
                                        isEmptyQuery
                                            ? "Showing frequently used items — type 3+ chars to search all products..."
                                            : "Type product name or nickname..."
                                    }
                                    className="w-full rounded-xl border-2 border-blue-500 bg-white px-1 py-1 text-base sm:text-lg font-semibold text-slate-900 shadow-xs outline-none focus:ring-2 focus:ring-blue-300"
                                />
                                {activeQuery.length > 0 && (
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() =>
                                            handleProductQueryChange(
                                                activeProductSearch.category,
                                                activeProductSearch.idx,
                                                ""
                                            )
                                        }
                                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Tile Grid Area */}
                        <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-transparent">
                            {!isEmptyQuery && activeQuery.trim().length < 3 ? (
                                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-medium text-slate-500">
                                    Keep typing — enter at least 3 characters to search products.
                                </div>
                            ) : !isEmptyQuery && isSearchingProducts && tilesToRender.length === 0 ? (
                                <div className="flex h-48 items-center justify-center rounded-xl border border-slate-200 bg-white p-4 text-center text-sm font-semibold text-blue-600">
                                    Searching products...
                                </div>
                            ) : tilesToRender.length === 0 ? (
                                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-semibold text-slate-500">
                                    {isEmptyQuery
                                        ? "No frequently used items yet. Select products or type 3+ characters to search."
                                        : `No matching products found for "${activeQuery.trim()}".`}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                                    {tilesToRender.map((p) => {
                                        const primaryLabel = getProductDisplayName(p);
                                        const showSecondaryName =
                                            p.base_name_nick &&
                                            p.base_name &&
                                            p.base_name_nick.trim() !== p.base_name.trim();

                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={() =>
                                                    selectProduct(
                                                        activeProductSearch.category,
                                                        activeProductSearch.idx,
                                                        p
                                                    )
                                                }
                                                className="group flex flex-col rounded-xl border border-slate-200 bg-sky-300/70 p-1 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-blue-500 hover:bg-blue-50/70 hover:shadow-md active:scale-[0.99]"
                                            >
                                                <span className="text-sm sm:text-base font-bold text-black group-hover:text-blue-700 leading-snug break-words">
                                                    {primaryLabel}
                                                </span>

                                                <div className="mt-0.5 pt-0.5 border-t border-slate-100 flex items-center justify-between gap-1">
                                                    <span className="text-xs text-slate-800">
                                                        {showSecondaryName ? p.base_name : isEmptyQuery ? p.base_name:p.base_name}
                                                    </span>
                                                    {/* <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                        Select
                                                    </span> */}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-7xl">
                <div className="flex items-center justify-between pb-1">
                    <h2 className="text-lg font-bold text-gray-900">New Order</h2>
                    <button
                        onClick={newOrder}
                        className="px-1 py-1 rounded-lg font-medium text-xl text-white shadow-sm transition-colors bg-green-400 hover:bg-green-700 active:bg-green-800"
                    >
                        🆕➕
                    </button>
                    <button
                        onClick={saveOrder}
                        disabled={isSubmitting || !canSave}
                        className={`px-3 py-0.25 rounded-lg font-medium text-2xl text-white shadow-sm transition-colors ${
                            canSave
                                ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                                : "bg-gray-400 cursor-not-allowed"
                        }`}
                    >
                        {isSubmitting ? "⌛In Progress..." : isModify ? "📝" : "💾"}
                    </button>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            navigator.clipboard.writeText(message).then(() => {
                                const url = `https://chat.whatsapp.com/GUZtwWJJE3UCPDccb4vqP6`;
                                window.open(url, "_blank");
                            });
                            alert("Order message copied to clipboard! " + message);
                        }}
                        disabled={!canWhatsApp}
                        className={`px-3 py-0.25 rounded-lg font-medium text-2xl text-white shadow-sm transition-colors ${
                            canWhatsApp
                                ? "bg-green-600 hover:bg-green-700 active:bg-green-800"
                                : "bg-gray-400 cursor-not-allowed"
                        }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 16 16"
                            style={{ display: "inline-block", verticalAlign: "middle" }}
                        >
                            <circle cx="8" cy="8" r="8" fill="#25D366" />
                            <path
                                fill="white"
                                d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"
                            />
                        </svg>
                    </button>
                    <span className="bg-green-300 inline-block min-w-14 text-lg text-center font-bold text-gray-700">
                        {grandTotal}
                    </span>
                </div>

                {/* DEALER SECTION */}
                <div className="mb-1 bg-sky-300 shadow rounded-xl border-gray-200 focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]">
                    <input
                        value={selectedDealer?.name ?? dealerQuery}
                        onChange={(e) => {
                            setSelectedDealer(null);
                            setDealerQuery(e.target.value);
                        }}
                        placeholder="Search dealer (min 3 characters)..."
                        className="w-full bg-sky-200 text-[18px] px-1 py-0 leading-relaxed border border-gray-300 rounded-lg 
                                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none 
                                    font-semibold not-placeholder-shown:bg-teal-100"
                    />
                    {selectedDealer ? null : (
                        <div className="mt-.25 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-sm">
                            {dealerOptions.length === 0 && dealerQuery.length >= 3 && (
                                <div className="px-4 py-1 text-center text-sm font-bold text-red-600">
                                    No dealers found
                                </div>
                            )}
                            {dealerOptions.map((d) => (
                                <div
                                    key={d.id}
                                    onClick={() => setSelectedDealer(d)}
                                    className="px-1 py-1 text-sm font-semibold hover:bg-blue-50 cursor-pointer transition-colors"
                                >
                                    {d.name} ({d.city})
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <textarea
                    value={narration}
                    onChange={(e) => setNarration(e.target.value)}
                    placeholder="Scheme/Payment/Adv Material or any other instructions..."
                    className="w-full px-1 border border-gray-300 rounded-lg font-semibold
                                align-top mb-0.5
                                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />

                {/* PRODUCTS SECTIONS */}
                <div className="space-y-1">
                    {/* ── ADULTS ──────────────────────────────────────────────── */}
                    <section className="bg-orange-500 shadow rounded-xl p-0.5 border border-gray-200">
                        <div className="flex items-center pl-2 justify-between">
                            <h2 className="text-md font-semibold">Gents / Ladies</h2>
                            <button
                                onClick={() => addRow("adult")}
                                className="px-2 py-1 bg-green-600 text-white rounded-lg 
                         hover:bg-green-700 transition-colors font-medium text-sm"
                            >
                                + Add Product
                            </button>
                        </div>

                        {adultItems.map((row, idx) => (
                            <div
                                key={`adult-${idx}`}
                                className="mb-0.5 last:mb-0 p-px border border-gray-200 rounded-lg bg-gray-50
                                            focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start gap-0 mb-0">
                                    <div className="flex gap-px min-w-0 mb-0 w-full">
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Remove this product -${row.product_name || ""}?`)) {
                                                    removeRow("adult", idx);
                                                }
                                            }}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap text-sm font-medium shadow-sm"
                                            title="Remove this product row"
                                        >
                                            X
                                        </button>
                                        <input
                                            value={adultProductQuery[idx] ?? ""}
                                            onFocus={() => setActiveProductSearch({ category: "adult", idx })}
                                            onChange={(e) => handleProductQueryChange("adult", idx, e.target.value)}
                                            placeholder="Search product (tap for frequent / min 3 chars)..."
                                            className="flex-1 px-1 py-.5 border border-gray-300 rounded-lg font-semibold
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none not-placeholder-shown:bg-orange-200"
                                        />

                                        <input
                                            type="number"
                                            value={row.price ?? ""}
                                            onChange={(e) => setPrice("adult", idx, e.target.value)}
                                            className="w-auto max-w-8.25 text-center
                                                                border border-gray-300 rounded-md
                                                                focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>

                                {/* SIZE HEADERS + INPUTS */}
                                <div className="overflow-x-auto leading-tight m-0 p-0">
                                    <div className="inline-flex gap-1.25 m-0 pl-px">
                                        {ADULT_SIZES.map((size) => (
                                            <div key={size} className="flex flex-col items-center w-8.25 pl-1 m-0">
                                                <span className="text-[14px] font-medium text-gray-500 leading-tight m-0 p-0">
                                                    {size}
                                                </span>
                                                <input
                                                    type="number"
                                                    value={row.quantities[size] ?? ""}
                                                    onChange={(e) => setQty("adult", idx, size, e.target.value)}
                                                    className={`text-[18px] w-auto max-w-8.75 text-center
                                                                border border-gray-300 rounded-md
                                                                ${row.quantities[size] ? "bg-orange-200" : "bg-transparent"}
                                                                focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
                                                />
                                            </div>
                                        ))}
                                        <span className="px-1 text-[15px] text-center font-medium text-gray-500 mb-0.5">
                                            Total
                                            <br />
                                            {getRowTotal(row.quantities)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>

                    {/* ── KIDS ────────────────────────────────────────────────── */}
                    <section className="bg-green-300 shadow rounded-xl p-0.5 border border-gray-200">
                        <div className="flex items-center pl-2 justify-between">
                            <h2 className="text-md font-semibold">Kids</h2>
                            <button
                                onClick={() => addRow("kids")}
                                className="px-2 py-1 bg-green-600 text-white rounded-lg 
                         hover:bg-green-700 transition-colors font-medium text-sm"
                            >
                                + Add Product
                            </button>
                        </div>

                        {kidsItems.map((row, idx) => (
                            <div
                                key={`kids-${idx}`}
                                className="mb-0.5 last:mb-0 p-px border border-gray-200 rounded-lg bg-gray-50
                                            focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start gap-0 mb-0">
                                    <div className="flex gap-px min-w-0 mb-0 w-full">
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Remove this product-${row.product_name || ""}?`)) {
                                                    removeRow("kids", idx);
                                                }
                                            }}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap text-sm font-medium shadow-sm"
                                            title="Remove this product row"
                                        >
                                            X
                                        </button>
                                        <input
                                            value={kidsProductQuery[idx] ?? ""}
                                            onFocus={() => setActiveProductSearch({ category: "kids", idx })}
                                            onChange={(e) => handleProductQueryChange("kids", idx, e.target.value)}
                                            placeholder="Search product (tap for frequent / min 3 chars)..."
                                            className="flex-1 px-1 py-.5 border border-gray-300 rounded-lg font-semibold
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none not-placeholder-shown:bg-yellow-200"
                                        />
                                        <input
                                            type="number"
                                            value={row.price ?? ""}
                                            onChange={(e) => setPrice("kids", idx, e.target.value)}
                                            className="w-auto max-w-8.25 text-center
                                                                border border-gray-300 rounded-md
                                                                focus:ring-1 focus:ring-blue-400 focus:border-blue-500 focus:bg-cyan-200"
                                        />
                                    </div>
                                </div>

                                {/* SIZE HEADERS + INPUTS */}
                                <div className="overflow-x-auto m-0 p-0 leading-tight">
                                    <div className="inline-flex gap-1.25 m-0 pl-px">
                                        {KIDS_SIZES.map((size) => (
                                            <div key={size} className="flex flex-col items-center w-8.25 pl-1 m-0">
                                                <span className="text-[14px] font-medium text-gray-500 m-0 p-0 leading-tight">
                                                    {size}
                                                </span>
                                                <input
                                                    type="number"
                                                    value={row.quantities[size] ?? ""}
                                                    onChange={(e) => setQty("kids", idx, size, e.target.value)}
                                                    className={`text-[18px] w-auto max-w-8.75 text-center
                                                                ${row.quantities[size] ? "bg-yellow-200" : "bg-transparent"}
                                                                border border-gray-300 rounded-md
                                                                focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
                                                />
                                            </div>
                                        ))}
                                        <span className="px-1 text-[15px] text-center font-medium text-gray-500">
                                            Total
                                            <br />
                                            {getRowTotal(row.quantities)}
                                        </span>
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