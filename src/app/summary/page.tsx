// app/summary/page.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDealers, getOrdersMatrix, getSkusByProductBase, searchDealers, deleteOrderMatrix } from '@/lib/data';

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
  const [pageSize, setPageSize] = useState(15); // Customizable page size
  const [currentPage, setCurrentPage] = useState(0); // Current page index
  const [refreshKey, setRefreshKey] = useState(0); // To trigger re-fetch after deletion  

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
  }, [selectedDealer, refreshKey]);

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

  // NEW: Delete handler
  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    if (!confirm('Are you sure you want to delete this order of '+selectedOrder.dealer?.name + ' (' + new Date(selectedOrder.created_at).toLocaleDateString("en-GB").replace("/20","/") +')?')) return;

    try {
      await deleteOrderMatrix(selectedOrder.order_id);
      setRefreshKey(prev=> prev + 1);           // refresh list
      // setIsModalOpen(false);
      setSelectedOrder(null);
      alert('Order of '+selectedOrder.dealer?.name + ' (' + new Date(selectedOrder.created_at).toLocaleDateString("en-GB").replace("/20","/") +')' +') deleted successfully');
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Group orders into logical "orders" based on dealer and created_at
  // Assuming items from the same API post share dealer and created_at
  useEffect(() => {
    const groupMap: Record<string, any> = {};
    orders.forEach((o: any) => {
      const key = `${o.dealer?.id}-${o.created_at}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          id: key, // Unique key for the group
          order_id: o.order_id, // Keep original order_id for reference
          dealer: o.dealer,
          created_at: o.created_at,
          items: [],
          narration: o.narration,
          total_qty: 0,
        };
      }
      groupMap[key].items.push({
        base: o.base,
        quantities: o.quantities,
        price: o.price,
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
    <div className="bg-gray-50 text-gray-800 p-2 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">Order summary</h1>
      <div><label className="text-sm font-medium">Records per page</label>
        <select
          className=" border rounded p-1"
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value));
            setCurrentPage(0); // Reset to first page
          }}
        >
          <option value={10}>15</option>
          <option value={20}>25</option>
          <option value={50}>50</option>
        </select>
        </div>
        </div>
      {/* DEALER SECTION */}
      <div className="mb-2 bg-sky-300 shadow rounded-xl p-2 pl-2 pt-0.25 border-gray-200 focus-within:shadow-[0_0_12px_4px_rgba(129,40,246,0.5)]">
          <label className="block text-md font-medium text-gray-700 mb-0.5">
              Dealer
          </label>
          <input
              value={selectedDealer?.name ?? dealerQuery}
              onChange={(e) => {
                  setSelectedDealer(null);
                  setDealerQuery(e.target.value);
              }}
              placeholder="Search dealer (min 3 characters)..."
              className="w-full bg-white md:w-96 px-2 py-1 border border-gray-300 rounded-lg 
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

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-center p-0.25">Dealer</th>
              <th className="text-center p-0.25">Date</th>
              <th className="text-center p-0.25">Total</th>
              {/* <th className="text-center p-0.25">Narration</th> */}
              {/* <th className="text-center p-0.25">Actions</th> */}
            </tr>
          </thead>
          <tbody>
            {paginatedGroups.map(g => (
              <tr key={g.id} className="border-t" onClick={()=> setSelectedOrder(g)}>
                <td className="p-0.25 pt-1 pb-1">{g.dealer?.name} ({g.dealer?.city})</td>
                <td className="p-0.25">{new Date(g.created_at).toLocaleDateString("en-GB").replace("/20","/")}</td>
                <td className="p-0.25 pl-0 pr-0.5 text-right">{g.total_qty}</td>
                {/* <td className="p-0.5">{g.narration || '-'}</td> */}
                {/* <td className="p-0.5 text-center"> */}
                  {/* <button
                    className="text-blue-600 hover:underline"
                    onClick={() => setSelectedOrder(g)}
                  >
                    View
                  </button> */}
                {/* </td> */}
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

      {/* Modal overlay for order details */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setSelectedOrder(null)} // Close on outside click
        >
          <div
            className="bg-white p-3 rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()} // Prevent close on inside click
          >
            <h3 className="text-md font-semibold mb-1">
              {selectedOrder.dealer?.name} ({new Date(selectedOrder.created_at).toLocaleString()})
            </h3>
            <div className="mb-2 italic text-sm border-1 border-amber-500">Narration:&nbsp;
            {selectedOrder.narration}
            </div>

            {/* Adult section */}
            {adultItems.length > 0 && (
              <div className="mb-2">
                <h3 className="text-md font-medium mb-0.25">GENTS/LADIES</h3>
                {adultItems.map((item: any, idx: number) => {
                  const quantities = item.quantities || {};
                  const total = Object.values(quantities).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
                  return (
                    <div key={idx} className="mb-2">
                      <div className="text-sm">{item.base?.base_name} {item.price>0 && `(${item.price})`}</div>
                      <table><tbody>
                        <tr className='border'>
                        {ADULT_SIZES.map(size => (
                          <td key={size} className="w-12 text-center text-sm font-medium border">{size}</td>
                        ))}
                        <td className="w-12 text-center text-sm font-medium">Total</td>
                      </tr>
                      <tr className='border'>  
                        {ADULT_SIZES.map(size => (
                      
                          <td key={size} className="w-12 text-center border p-0">
                            {quantities[size] || 0}
                      
                          </td>
                        ))}                      
                        <td className="w-12 text-center p-0">{total}</td>
                      </tr>
                      </tbody></table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Kids section */}
            {kidsItems.length > 0 && (
              <div className="mb-2">
                <h3 className="text-md font-medium mb-0.25">Kids</h3>
                {kidsItems.map((item: any, idx: number) => {
                  const quantities = item.quantities || {};
                  const total = Object.values(quantities).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
                  return (
                    <div key={idx} className="mb-2">
                      <div className="text-sm">{item.base?.base_name} {item.price>0 && `(${item.price})`}</div>
                      {/* <div className="flex gap-2 mt-1"> */}
                      <table><tbody>
                        <tr className='border'>
                        {KIDS_SIZES.map(size => (
                          <td key={size} className="w-12 text-center text-sm font-medium border">
                            {size}
                          </td>
                        ))}
                        <td className="w-12 text-center text-sm font-medium">Total</td>
                      </tr>
                      <tr className='border'>
                        {KIDS_SIZES.map(size => (                      
                          <td key={size} className="w-12 text-center border p-0">
                            {quantities[size] || 0}
                          </td>
                        ))}
                        <td className="w-12 text-center p-0">{total}</td>
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
                onClick={handleDeleteOrder}
              >
                🗑️ Delete Order
              </button>
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