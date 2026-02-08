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
  const [pageSize, setPageSize] = useState(10); // Customizable page size
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
    <div className="bg-gray-50 text-gray-800 p-2 space-y-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Admin</h1>
      <div>
        <h2 className="text-lg font-medium">Totals by product</h2>
        <ul className="list-disc pl-6">
          {Object.entries(totalsByBase).map(([name, qty]) => (
            <li key={name}>{name}: {qty}</li>
          ))}
        </ul>
      </div>      
    </div>
  );
}