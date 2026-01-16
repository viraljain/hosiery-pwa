// app/summary/page.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDealers, getOrdersMatrix, getSkusByProductBase, searchDealers } from '@/lib/data';

type Dealer = { id: string; name: string; phone?: string };

// const ADULT_SIZES = ["75/78", "80", "85", "90", "95", "100", "105", "110", "120"];
const ADULT_SIZES = ["77", "80", "85", "90", "95", "100", "105", "110", "120"];
const KIDS_SIZES = ["35", "40", "45", "50", "55", "60", "65", "70", "75"];

export default function SummaryPage() {
  // const [dealers, setDealers] = useState<any[]>([]);
  // const [dealerId, setDealerId] = useState('');

  const [dealerQuery, setDealerQuery] = useState("");
  const [dealerOptions, setDealerOptions] = useState<Dealer[]>([]);
  const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);

  const [orders, setOrders] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]); // Grouped orders
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null); // For modal
  const [pageSize, setPageSize] = useState(10); // Customizable page size
  const [currentPage, setCurrentPage] = useState(0); // Current page index

  const debounceRef = useRef<number | null>(null);

  // Fetch dealers on mount
  // useEffect(() => {
  //   getDealers().then(({ data }) => setDealers(data ?? []));
  // }, []);

  // Fetch and filter orders when dealerId changes
  // useEffect(() => {
  //   getOrdersMatrix().then(({ data }) => {
  //     const list = (data ?? []).filter((o: any) => !dealerId || o.dealer?.id === dealerId);
  //     setOrders(list);
  //   });
  // }, [dealerId]);

    // Fetch and filter orders when dealerId changes
  useEffect(() => {
    getOrdersMatrix().then(({ data }) => {
      const list = (data ?? []).filter((o: any) => !selectedDealer || o.dealer?.id === selectedDealer.id);
      setOrders(list);
    });
  }, [selectedDealer]);

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
  

  // Group orders into logical "orders" based on dealer and created_at
  // Assuming items from the same API post share dealer and created_at
  useEffect(() => {
    const groupMap: Record<string, any> = {};
    orders.forEach((o: any) => {
      const key = `${o.dealer?.id}-${o.created_at}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          id: key, // Unique key for the group
          dealer: o.dealer,
          created_at: o.created_at,
          items: [],
          total_qty: 0,
        };
      }
      groupMap[key].items.push({
        base: o.base,
        quantities: o.quantities,
      });
      // Add to total qty
      const itemQty = Object.values(o.quantities || {}).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
      groupMap[key].total_qty += itemQty;
    });

    // Convert to array and sort by created_at descending
    const sortedGroups = Object.values(groupMap).sort((a: any, b: any) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setGroups(sortedGroups);
  }, [orders]);

  // Compute totals by base across all filtered orders
  const totalsByBase = useMemo(() => {
    const agg: Record<string, number> = {};
    orders.forEach((o: any) => {
      const baseName = o.base?.base_name;
      const itemQty = Object.values(o.quantities || {}).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
      agg[baseName] = (agg[baseName] ?? 0) + itemQty;
    });
    return agg;
  }, [orders]);

  // Paginate the groups
  const paginatedGroups = useMemo(() => {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    return groups.slice(start, end);
  }, [groups, currentPage, pageSize]);

  // Total pages
  const totalPages = Math.ceil(groups.length / pageSize);

  // Classify items into adult and kids for the selected order
  const { adultItems, kidsItems } = useMemo(() => {
    if (!selectedOrder) return { adultItems: [], kidsItems: [] };
    const adult = selectedOrder.items.filter((i: any) =>
      Object.keys(i.quantities || {}).some((k: string) => ADULT_SIZES.includes(k))
    );
    const kids = selectedOrder.items.filter((i: any) =>
      Object.keys(i.quantities || {}).some((k: string) => KIDS_SIZES.includes(k))
    );
    return { adultItems: adult, kidsItems: kids };
  }, [selectedOrder]);

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto dark:text-white">
      <h1 className="text-xl font-semibold">Order summary</h1>

      {/* <div className="space-y-2">
        <label className="text-sm font-medium">Filter by dealer</label>
        <select className="w-full border rounded p-2" value={dealerId} onChange={e => setDealerId(e.target.value)}>
          <option value="">All dealers</option>
          {dealers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.city})</option>)}
        </select>
      </div> */}

      {/* DEALER SECTION */}
      <div className="mb-2 bg-white dark:bg-gray-800 shadow rounded-xl p-2 pl-4 pt-0.25 border-gray-200 focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]">
          <label className="block text-md font-medium text-gray-700 dark:text-white mb-0.5">
              Dealer
          </label>
          <input
              value={selectedDealer?.name ?? dealerQuery}
              onChange={(e) => {
                  setSelectedDealer(null);
                  setDealerQuery(e.target.value);
              }}
              placeholder="Search dealer (min 3 characters)..."
              className="w-full md:w-96 px-2 py-1 border border-gray-300 rounded-lg 
                          focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none "
          />
          {selectedDealer ? null :
              (
                  <div className="mt-1 border border-gray-200 rounded-lg max-h-60 overflow-y-auto bg-white shadow-sm">
                      {dealerOptions.length === 0 && dealerQuery.length >= 3 && (
                          <div className="px-4 py-1 text-center text-sm font-bold  text-red-600">No dealers found</div>
                      )}
                      {dealerOptions.map((d) =>
                      (
                          <div key={d.id} onClick={() => setSelectedDealer(d)}
                              className="px-4 py-1 text-sm dark:text-gray-950 hover:bg-blue-50 cursor-pointer transition-colors ">
                              {d.name}
                          </div>
                      ))}
                  </div>
              )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Records per page</label>
        <select
          className="w-full border rounded p-2"
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value));
            setCurrentPage(0); // Reset to first page
          }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-400">
            <tr>
              <th className="text-left p-2">Dealer</th>
              <th className="text-left p-2">Date</th>
              <th className="text-right p-2">Total Qty</th>
              <th className="text-left p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedGroups.map(g => (
              <tr key={g.id} className="border-t">
                <td className="p-2">{g.dealer?.name} ({g.dealer?.city})</td>
                <td className="p-2">{new Date(g.created_at).toLocaleString()}</td>
                <td className="p-2 text-right">{g.total_qty}</td>
                <td className="p-2">
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => setSelectedOrder(g)}
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex justify-between items-center">
        <button
          className="px-4 py-2 bg-gray-200 dark:bg-gray-400 rounded disabled:opacity-50"
          disabled={currentPage === 0}
          onClick={() => setCurrentPage(p => p - 1)}
        >
          Prev
        </button>
        <span>Page {currentPage + 1} of {totalPages}</span>
        <button
          className="px-4 py-2 bg-gray-200 dark:bg-gray-400 rounded disabled:opacity-50"
          disabled={currentPage + 1 >= totalPages}
          onClick={() => setCurrentPage(p => p + 1)}
        >
          Next
        </button>
      </div>

      <div>
        <h2 className="text-lg font-medium">Totals by product</h2>
        <ul className="list-disc pl-6">
          {Object.entries(totalsByBase).map(([name, qty]) => (
            <li key={name}>{name}: {qty}</li>
          ))}
        </ul>
      </div>

      {/* Modal overlay for order details */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedOrder(null)} // Close on outside click
        >
          <div
            className="bg-white dark:bg-gray-500/93 p-6 rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()} // Prevent close on inside click
          >
            <h2 className="text-lg font-semibold mb-4">
              Order Details for {selectedOrder.dealer?.name} on {new Date(selectedOrder.created_at).toLocaleString()}
            </h2>

            {/* Adult section */}
            {adultItems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-md font-medium mb-2">Gents/Ladies</h3>
                {adultItems.map((item: any, idx: number) => {
                  const quantities = item.quantities || {};
                  const total = Object.values(quantities).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
                  return (
                    <div key={idx} className="mb-4">
                      <div className="font-medium">{item.base?.base_name}</div>
                      {/* <div className="flex gap-2 mt-1"> */}
                      <table><tbody>
                        <tr className='border'>
                        {ADULT_SIZES.map(size => (
                          // <div key={size} className="w-12 text-center text-sm font-medium">
                          //   {size}
                          // </div>
                          <td key={size} className="w-12 text-center text-sm font-medium border">{size}</td>
                        ))}
                        {/* <div className="w-12 text-center text-sm font-medium">Total</div> */}
                        <td className="w-12 text-center text-sm font-medium">Total</td>
                      </tr>
                      {/* <div className="flex gap-2 mt-1"> */}
                      <tr className='border'>  
                        {ADULT_SIZES.map(size => (
                          // <div key={size} className="w-12 text-center">
                          <td key={size} className="w-12 text-center border">
                            {quantities[size] || 0}
                          {/* </div> */}
                          </td>
                        ))}
                        {/* <div className="w-12 text-center">{total}</div> */}
                        <td className="w-12 text-center">{total}</td>
                      {/* </div> */}
                      </tr>
                      </tbody></table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Kids section */}
            {kidsItems.length > 0 && (
              <div className="mb-6">
                <h3 className="text-md font-medium mb-2">Kids</h3>
                {kidsItems.map((item: any, idx: number) => {
                  const quantities = item.quantities || {};
                  const total = Object.values(quantities).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
                  return (
                    <div key={idx} className="mb-4">
                      <div className="font-medium">{item.base?.base_name}</div>
                      {/* <div className="flex gap-2 mt-1"> */}
                      <table><tbody>
                        <tr className='border'>
                        {KIDS_SIZES.map(size => (
                          // <div key={size} className="w-12 text-center text-sm font-medium">
                          <td key={size} className="w-12 text-center text-sm font-medium border">
                            {size}
                          {/* </div> */}
                          </td>
                        ))}
                        {/* <div className="w-12 text-center text-sm font-medium">Total</div> */}
                        <td className="w-12 text-center text-sm font-medium">Total</td>
                      {/* </div> */}
                      </tr>
                      {/* <div className="flex gap-2 mt-1"> */}
                      <tr className='border'>
                        {KIDS_SIZES.map(size => (
                          // <div key={size} className="w-12 text-center">
                          <td key={size} className="w-12 text-center border">
                            {quantities[size] || 0}
                          {/* </div> */}
                          </td>
                        ))}
                        {/* <div className="w-12 text-center">{total}</div> */}
                        <td className="w-12 text-center">{total}</td>
                      {/* </div> */}
                      </tr>
                      </tbody></table>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-right">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}