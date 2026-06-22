// src/app/order/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchProducts, searchDealers, getOrderbyId } from "@/lib/data";
import React from "react";
import clipboardy from "clipboardy";
import { useSearchParams } from "next/navigation";
import { setDefaultAutoSelectFamily } from "net";

type Dealer = { id: string; name: string; phone?: string, city?: string };
type Product = { id: string; base_name: string; base_name_nick?: string };
type ItemRow = { index: number; base_id?: string; product_name?: string; product_name_nick?: string; quantities: Record<string, number>; price?: number };

// const ADULT_SIZES = ["75/78", "80", "85", "90", "95", "100", "105", "110", "120"];
const ADULT_SIZES = ["77", "80", "85", "90", "95", "100", "105", "110", "120"];
const KIDS_SIZES = ["35", "40", "45", "50", "55", "60", "65", "70", "75"];

// interface OrderPageProps {
//     searchParams?: { [key: string]: string | string[] | undefined };
// }

// export default function OrderPage() {
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

    const [narration, setNarration] = useState<string>('');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const debounceRef = useRef<number | null>(null);

    // ── Query parameters ────────────────────────────────────────────────
    //const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
    /** WORKING IN DEV but in Vercel Production - PRERENDER ERROR due to useSearchParams * */
    // const searchParams = useSearchParams();   // ✅ returns URLSearchParams
    //const orderId = searchParams.get("orderId");
    /** * */
    const orderId = React.use(searchParams).orderId;
    // const orderId = searchParams?.orderId as string | undefined;
    const isModify = !!orderId;


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
        })
    };

    const setQty = (category: "adult" | "kids", idx: number, size: string, val: string) => {
        const v = Number(val) || 0;
        const setter = category === "adult" ? setAdultItems : setKidsItems;

        setter((prev) => {
            const next = [...prev];
            next[idx] = {
                ...next[idx],
                quantities: { ...next[idx].quantities, [size]: v },
                index: idx
            };
            return next;
        });
    };

    // Total for a single row (you can keep it inline or extract)
    const getRowTotal = (quantities: Record<string, number>) =>
        Object.values(quantities || 0).reduce((sum, q) => sum + (Number(q) || 0), 0);

    // Grand total - all adult rows + all kids rows
    const grandTotal = useMemo(() => {
        const adultSum = adultItems.reduce(
            (sum, row) => {
                if (!row || !row.quantities) return sum;
                return sum + getRowTotal(row.quantities || 0)
            },
            0
        );
        const kidsSum = kidsItems.reduce(
            (sum, row) => {
                if (!row || !row.quantities) return sum;
                return sum + getRowTotal(row.quantities || 0)
            },
            0
        );
        return adultSum + kidsSum;
    }, [adultItems, kidsItems]);

    const selectProduct = (category: "adult" | "kids", idx: number, p: Product) => {
        const setterItems = category === "adult" ? setAdultItems : setKidsItems;
        const setterQuery = category === "adult" ? setAdultProductQuery : setKidsProductQuery;
        const setterOptions = category === "adult" ? setAdultProductOptions : setKidsProductOptions;

        setterItems((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], base_id: p.id, product_name: p.base_name, product_name_nick: p.base_name_nick };
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

    // 15 June 2026 - ORDER UPDATE LOGIC - Load existing order details if orderId is present in query params
    const firstLoadRef = useRef(false);
    useEffect(() => {
        if (firstLoadRef.current) return;
        firstLoadRef.current = true;
        if (isModify) {
            console.log("Fetched orderId - ", orderId);
            // alert("Modify mode detected. Fetching order details for orderId: " + orderId);

            getOrderbyId(orderId as string).then(({ data, error }) => {
                if (error) {
                    alert("Error fetching order details: " + error.message);
                    return;
                }
                if (data) {
                    // alert("Order details fetched successfully for orderId: " + orderId + "\n" + JSON.stringify(data));
                    if (data.length > 0) {
                        const order = data[0];
                        setSelectedDealer(Array.isArray(order.dealer) ? order.dealer[0] : order.dealer);
                        setNarration(order.narration || "");
                        removeRow("adult", 0); // Remove the initial empty row
                        removeRow("kids", 0);  // Remove the initial empty row

                        let index_adult = 0, index_kids = 0;

                        // Assuming adultItems and kidsItems are stored in the order data
                        for (let index = 0; index < data.length; index++) {
                            const element = data[index];
                            const adult = Object.keys(element.quantities).some((k: string) => ADULT_SIZES.includes(k));
                            const kids = Object.keys(element.quantities || 0).some((k: string) => KIDS_SIZES.includes(k));
                            if (adult) {
                                addRow("adult");
                                selectProduct("adult", index_adult, Array.isArray(element.base) ? element.base[index] : element.base);
                                for (const [size, qty] of Object.entries(element.quantities)) {
                                    setQty("adult", index_adult, size, String(qty));
                                }
                                index_adult++;
                            }
                            if (kids) {
                                addRow("kids");
                                selectProduct("kids", index_kids, Array.isArray(element.base) ? element.base[index] : element.base);
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
    const [canWhatsApp, setCanWhatsApp] = useState<boolean>(false);
    // ── UI & Save logic ─────────────────────────────────────────────────
    const canSave = useMemo(() => {
        if (!selectedDealer?.id) return false;
        if (canWhatsApp) return false;
        const hasValidAdult = adultItems.some(
            (i) => {
                if (!i) return false;
                return i.base_id && Object.values(i.quantities).some((q) => q > 0)
            });
        const hasValidKids = kidsItems.some(
            (i) => {
                if (!i) return false;
                return i.base_id && Object.values(i.quantities).some((q) => q > 0)
            });
        return hasValidAdult || hasValidKids;
    }, [adultItems, kidsItems, selectedDealer, canWhatsApp]);


    const [message, setMessage] = useState<string>('');
    const saveOrder = async () => {
        if (isSubmitting) return; //Prevent multiple clicks
        if (!selectedDealer?.id) {
            alert("Select a dealer");
            return;
        }
        const items = [...adultItems, ...kidsItems];
        if (items.length === 0 || !items.some(i => i.base_id && Object.values(i.quantities).some(q => (q ?? 0) > 0))) {
            alert("Add at least one item with quantity");
            return;
        }

        setIsSubmitting(true);  //Submitting starts - now Save/Modify button is disabled

        const payload = {
            pl_order_id: isModify ? orderId : '',
            pl_dealer_id: selectedDealer.id,
            pl_items: items.map(i => ({
                index: i.index,
                base_id: i.base_id,
                price: typeof i.price === "number" ? i.price : 0,
                quantities: Object.fromEntries(
                    Object.entries(i.quantities).filter(([, q]) => Number(q) > 0)
                ),
            })),
            pl_narration: narration
        };
        const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        // alert("Saving order..." + JSON.stringify(payload));
        const data = await res.json();
        if (!res.ok) {
            setIsSubmitting(false); //Submitting ends - Error detected - now Save/Modify button is enabled
            alert(`Error: ${data.error || "Failed to save"}`);
            return;
        }

        // Build WhatsApp message and open deep link
        const message1 = buildWhatsAppMessage({
            orderId: data.order_id,
            dealerName: selectedDealer.name,
            adultItems: adultItems, kidsItems: kidsItems,
            narration: narration
        });
        setMessage(message1);
        setCanWhatsApp(true);

        alert("Order saved successfully" + "\n\n" + message1);

        // navigator.clipboard.writeText(message).then(() => { 
        //     const url = `https://chat.whatsapp.com/GUZtwWJJE3UCPDccb4vqP6`;
        //     window.open(url, "_blank");
        //  });

        // const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        // const url = `https://chat.whatsapp.com/GUZtwWJJE3UCPDccb4vqP6`;
        // window.open(url, "_blank");  


        // reset
        setSelectedDealer(null);
        setNarration("");
        setDealerQuery("");
        setDealerOptions([]);

        setIsSubmitting(false);

        setAdultItems([{ quantities: {}, index: 0 }]);
        setAdultProductQuery([""]);
        setAdultProductOptions([[]]);

        setKidsItems([{ quantities: {}, index: 0 }]);
        setKidsProductQuery([""]);
        setKidsProductOptions([[]]);
    };
    function buildWhatsAppMessage({ orderId, dealerName, adultItems, kidsItems, narration }
        : { orderId: string; dealerName?: string; adultItems: ItemRow[]; kidsItems: ItemRow[]; narration?: string }) {
        const header = [dealerName ? `${dealerName}` : null].filter(Boolean).join("\n");

        const adultItemsLines = adultItems
            .filter(i => i.product_name)
            .map(i => {
                const qtys = Object.entries(i.quantities)
                    .filter(([, q]) => Number(q) > 0)
                    .map(([s, q]) => `${s}/${q}`)
                    .join(", ");
                return `${(i.product_name_nick ?? "").length > 0 ? i.product_name_nick : i.product_name}${Number(i.price) > 0 ? "(" + (i.price) + ")" : ""}: ${qtys || "—"}`;
            }).join("\n").replaceAll(/MAESTRO/gi, "M.").replaceAll(/DIVYA/gi, "D.").replaceAll(/PLATINUM/gi, "P.").replaceAll(/RN/gi, "RN").replaceAll(/RNS/gi, "RNS")
            .toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); // capitalize first letters
        ;
        const kidsItemsLines = kidsItems
            .filter(i => i.product_name)
            .map(i => {
                const qtys = Object.entries(i.quantities)
                    .filter(([, q]) => Number(q) > 0)
                    .map(([s, q]) => `${s}/${q}`)
                    .join(", ");
                return `${(i.product_name_nick ?? "").length > 0 ? i.product_name_nick : i.product_name}${Number(i.price) > 0 ? "(" + (i.price) + ")" : ""}: ${qtys || "—"}`;
            }).join("\n").replaceAll(/MAESTRO/gi, "M.").replaceAll(/DIVYA/gi, "D.").replaceAll(/PLATINUM/gi, "P.").replaceAll(/RN/gi, "RN").replaceAll(/RNS/gi, "RNS")
            .toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); // capitalize first letters

        return `${header}\n${adultItemsLines}\n${kidsItemsLines}\n${narration ? 'Note: ' + narration : ''}`;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-1 px-1.5 sm:px-2 lg:px-3">
            <div className="mx-auto max-w-7xl">
                <div className="flex items-center justify-between pb-1">
                    <h2 className="text-xl font-bold text-gray-900">New Order</h2>
                    <button
                        onClick={saveOrder}
                        disabled={isSubmitting || !canSave}
                        className={`px-3 py-1 rounded-lg font-medium text-white shadow-sm transition-colors
                                    ${canSave ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                                : "bg-gray-400 cursor-not-allowed"
                            }`}>
                        {isSubmitting ? "⌛In Progress..." : (isModify ? "📝MODIFY" : "💾SAVE")}
                    </button>
                    <button onClick={(e) => {
                        e.preventDefault();
                        navigator.clipboard.writeText(message).then(() => {
                            const url = `https://chat.whatsapp.com/GUZtwWJJE3UCPDccb4vqP6`;
                            window.open(url, "_blank");
                        });
                        alert("Order message copied to clipboard! " + message);
                        // const url = `https://chat.whatsapp.com/GUZtwWJJE3UCPDccb4vqP6`;
                        // window.open(url, "_blank");
                    }}
                        disabled={!canWhatsApp}
                        className={`px-3 py-1 rounded-lg font-medium text-white shadow-sm transition-colors
                                    ${canWhatsApp ? "bg-green-600 hover:bg-blue-700 active:bg-blue-800"
                                : "bg-gray-400 cursor-not-allowed"
                            }`}
                    ><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 16 16" style={{ display: "inline-block", verticalAlign: "middle" }}>
                            <circle cx="8" cy="8" r="8" fill="#25D366" />
                            <path fill="white" d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />WApp
                        </svg>WApp
                    </button>
                    {/* <a href="#"
                      onClick={(e) => 
                                    {
                                      e.preventDefault();
                                      if (!canSave){alert("Please save the order first"); return;}
                                      navigator.clipboard.writeText(message).then(() => {
                                        window.open("https://chat.whatsapp.com/GUZtwWJJE3UCPDccb4vqP6", "_blank");
                                      });
                                    }
                            }
            className={`px-2 py-1 rounded text-white transition-colors ${canSave ? "bg-green-600 hover:bg-green-700 cursor-pointer" : "bg-gray-400 cursor-not-allowed"}`}
          > */}
                    {/* Send to WhatsApp Group (Message copied -&gt; Open Group -&gt; Paste in chat & Send) */}
                    {/* WApp Group & Paste */}
                    {/* </a> */}
                    <span className="bg-green-300 inline-block min-w-25 text-xl text-center font-bold text-gray-700">
                        Total {grandTotal}
                    </span>
                </div>

                {/* DEALER SECTION */}
                <div className="mb-1 bg-sky-300 shadow rounded-xl border-gray-200 focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]">
                    {/* <label className="block text-md font-medium text-gray-700 mb-0.5">
                        Dealer
                    </label> */}
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
                    {selectedDealer ? null :
                        (
                            <div className="mt-.25 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-sm">
                                {dealerOptions.length === 0 && dealerQuery.length >= 3 && (
                                    <div className="px-4 py-1 text-center text-sm font-bold  text-red-600">No dealers found</div>
                                )}
                                {dealerOptions.map((d) =>
                                (
                                    <div key={d.id} onClick={() => setSelectedDealer(d)}
                                        className="px-1 py-1 text-sm font-semibold hover:bg-blue-50 cursor-pointer transition-colors ">
                                        {d.name} ({d.city})
                                    </div>
                                ))}
                            </div>
                        )}
                </div>
                {/* <div className="bg-red-900 leading-rounded-xl m-0 p-0"> */}
                <textarea value={narration} onChange={(e) => setNarration(e.target.value)}
                    placeholder="Scheme/Payment/Adv Material or any other instructions..."
                    className="w-full px-1 border border-gray-300 rounded-lg font-semibold
                                align-top mb-0.5
                                focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none "
                />
                {/* </div> */}
                {/* PRODUCTS SECTIONS */}
                <div className="space-y-1">
                    {/* ── ADULTS ──────────────────────────────────────────────── 
                    mb-2 bg-white shadow rounded-xl p-2 pl-4 pt-0.25 border-gray-200 focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]*/}
                    <section className="bg-orange-500 shadow rounded-xl p-0.5 border border-gray-200">
                        <div className="flex items-center pl-2 justify-between">
                            <h2 className="text-md font-semibold ">Gents / Ladies</h2>
                            <button
                                onClick={() => addRow("adult")}
                                className="px-2 py-1 bg-green-600 text-white rounded-lg 
                         hover:bg-green-700 transition-colors font-medium text-sm">
                                + Add Product
                            </button>
                        </div>

                        {adultItems.map((row, idx) => (
                            <div key={`adult-${idx}`}
                                className="mb-0.5 last:mb-0 p-px border border-gray-200 rounded-lg bg-gray-50
                                            focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]">

                                <div className="flex flex-col sm:flex-row sm:items-start gap-0 mb-0">
                                    <div className="flex gap-px min-w-0 mb-0">
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Remove this product -${row.product_name || ""}?`)) {
                                                    removeRow("adult", idx);
                                                }
                                            }}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap text-sm font-medium shadow-sm"
                                            title="Remove this product row"
                                        >X</button>
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
                                            className="flex-1 px-1 py-.5 border border-gray-300 rounded-lg font-semibold
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none not-placeholder-shown:bg-orange-200"
                                        />

                                        <input type="number" value={row.price ?? ""}
                                            onChange={(e) => setPrice("adult", idx, e.target.value)}
                                            className="w-auto max-w-8.25 text-center
                                                                border border-gray-300 rounded-md
                                                                focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="mt-0 p-0">
                                        {!row.base_id && adultProductOptions[idx]?.length > 0 && (
                                            <div className="mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-sm">
                                                {adultProductOptions[idx].map((p) => (
                                                    <div
                                                        key={p.id}
                                                        className="px-2 py-.25  hover:bg-blue-50 cursor-pointer transition-colors"
                                                        onClick={() => selectProduct("adult", idx, p)}
                                                    >
                                                        {p.base_name_nick ? p.base_name_nick : p.base_name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
                                                <input type="number" value={row.quantities[size] ?? ""}
                                                    onChange={(e) => setQty("adult", idx, size, e.target.value)}
                                                    className={`text-[18px] w-auto max-w-8.75 text-center
                                                                border border-gray-300 rounded-md
                                                                ${row.quantities[size] ? 'bg-orange-200' : 'bg-transparent'}
                                                                focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
                                                />
                                            </div>
                                        ))}
                                        <span className="px-1 text-[15px] text-center font-medium text-gray-500 mb-0.5">Total<br />{getRowTotal(row.quantities)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                    {/* ── KIDS ────────────────────────────────────────────────── */}
                    <section className="bg-green-300 shadow rounded-xl p-0.5 border border-gray-200">
                        <div className="flex items-center pl-2 justify-between">
                            <h2 className="text-md font-semibold ">Kids</h2>
                            <button
                                onClick={() => addRow("kids")}
                                className="px-2 py-1 bg-green-600 text-white rounded-lg 
                         hover:bg-green-700 transition-colors font-medium text-sm">
                                + Add Product
                            </button>
                        </div>

                        {kidsItems.map((row, idx) => (
                            <div key={`kids-${idx}`}
                                className="mb-0.5 last:mb-0 p-px border border-gray-200 rounded-lg bg-gray-50
                                            focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]">

                                <div className="flex flex-col sm:flex-row sm:items-start gap-0 mb-0">
                                    <div className="flex gap-px min-w-0 mb-0">
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Remove this product-${row.product_name || ""}?`)) {
                                                    removeRow("kids", idx);
                                                }
                                            }}
                                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors whitespace-nowrap text-sm font-medium shadow-sm"
                                            title="Remove this product row"
                                        >X</button>
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
                                            className="flex-1 px-1 py-.5 border border-gray-300 rounded-lg  font-semibold
                               focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none not-placeholder-shown:bg-yellow-200"
                                        />
                                        <input type="number" value={row.price ?? ""}
                                            onChange={(e) => setPrice("kids", idx, e.target.value)}
                                            className="w-auto max-w-8.25 text-center
                                                                border border-gray-300 rounded-md
                                                                focus:ring-1 focus:ring-blue-400 focus:border-blue-500 focus:bg-cyan-200"
                                        />
                                    </div>
                                    <div className="mt-0 p-0">
                                        {!row.base_id && kidsProductOptions[idx]?.length > 0 && (
                                            <div className="mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-sm">
                                                {kidsProductOptions[idx].map((p) => (
                                                    <div
                                                        key={p.id}
                                                        className="px-2 py-.25  hover:bg-blue-50 cursor-pointer transition-colors"
                                                        onClick={() => selectProduct("kids", idx, p)}
                                                    >
                                                        {p.base_name_nick ? p.base_name_nick : p.base_name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
                                                <input type="number" value={row.quantities[size] ?? ""}
                                                    onChange={(e) => setQty("kids", idx, size, e.target.value)}
                                                    className={`text-[18px] w-auto max-w-8.75 text-center
                                                                ${row.quantities[size] ? 'bg-yellow-200' : 'bg-transparent'}
                                                                border border-gray-300 rounded-md
                                                                focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
                                                />
                                            </div>
                                        ))}
                                        <span className="px-1 text-[15px] text-center font-medium text-gray-500">Total<br />{getRowTotal(row.quantities)}</span>
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