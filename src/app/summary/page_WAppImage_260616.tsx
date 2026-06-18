// app/summary/page.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDealers, getOrdersMatrix, getSkusByProductBase, searchDealers, deleteOrderMatrix } from '@/lib/data';
import html2canvas from 'html2canvas-pro';
import * as htmlToImage from 'html-to-image';

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

  // EXPORT ORDER TO SGM
  // const [status, setStatus] = useState('');

  async function exportOrder(orderId: string) {
    // setStatus('Exporting...');
    const res = await fetch('/api/exportorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });

    const data = await res.json();
    console.log('Export response:', data);

    if (res.ok) {
      alert(data.message || 'Order exported successfully');
    } else {
      alert(data.error || 'Order export failed');
    }
    // setStatus(data.message || data.error);
  }

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

  const handleUpdateOrder = async () => {
    if (!selectedOrder) return;
  };

  const captureRef = useRef<HTMLDivElement>(null);
  // const newRef = useRef<HTMLDivElement>(null);
  const handleWAppImage = async () => {
    var element = document.getElementById('order-details-modal');
    console.log('Element for capture:', element);

    // Extra stabilization for tables + React
    await document.fonts.ready; // Ensure fonts are loaded for accurate rendering
    // await new Promise(resolve => setTimeout(resolve, 120)); // Let layout settle before capture
    // await setTimeout(() => {},1000); // wait 1 second between items
    await html2canvas(element as HTMLElement, {
      useCORS: true,
      // backgroundColor: "#ffffff",
      // windowWidth: captureWidth,
      // windowHeight: captureHeight,
      // width: captureWidth,
      // height: captureHeight,
      // scale: Math.max(1, window.devicePixelRatio || 1),
      // allowTaint: false,
      // foreignObjectRendering: true,
      imageTimeout: 15000,
    }).then(canvas => {
      //const imgData = canvas.toDataURL('image/png');
      // const wAppUrl = `https://wa.me/?text=${encodeURIComponent(imgData)}`;
      // window.open(wAppUrl, '_blank');

      // download - WORKING - but difficult to share - involves multiple steps and user has to find the file
      // const link = document.createElement('a');
      // link.download = selectedOrder.dealer?.name+'_'+new Date(selectedOrder.created_at).toUTCString() + '.png';
      // link.href = imgData;
      // link.click();

      canvas.toBlob((blob: any) =>  {
        const file = new File([blob], `${selectedOrder.dealer?.name}_${new Date(selectedOrder.created_at).toLocaleDateString("en-GB").replace("/20","/")}.png`, { type: 'image/png' });
        navigator.share({
          title: `ORDER-${selectedOrder.dealer?.name}`,
          text: `ORDER-${selectedOrder.dealer?.name} (${new Date(selectedOrder.created_at).toLocaleDateString("en-GB").replace("/20","/")})`,
          files: [file]
        });
      });
    });

    element=null;

    /* ***** Trying HTML-TO-IMAGE now ***** */
    //  if (!captureRef.current){ alert('Capture reference is not available'); return;}
    // const dataUrl =   await htmlToImage.toPng(captureRef.current as HTMLElement, { cacheBust: true, backgroundColor: "#ffffff" });
    // // alert('dataUrl - '+dataUrl);
    // // window.open(dataUrl, '_blank');


    //   // Convert dataUrl → Blob
    //   const blob = await fetch(dataUrl).then((res) => res.blob());
    //   // alert('Blob - '+blob.stream().toString());
    //   const file = new File([blob], 'capture.png', { type: 'image/png' });

    //   const shareData = {
    //     title: 'Shared Content',
    //     text: 'Here is the captured content 👇',
    //     files: [file],
    //   };

    //   if (navigator.canShare?.(shareData)) {
    //     await navigator.share(shareData);
    //   } else {
    //     // fallbackDownload(dataUrl);
    //   }
  }

  const handleWAppText = () => {
    if (!selectedOrder) return;

  }

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
          challan: o.SGMChallanNum
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
              <th className="text-center p-0.25">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedGroups.map(g => (
              <tr key={g.id} className="border-t" onClick={()=> setSelectedOrder(g)}>
                <td className="p-0.25 pt-1 pb-1 font-semibold">{g.dealer?.name} ({g.dealer?.city})</td>
                <td className="p-0.25">{new Date(g.created_at).toLocaleDateString("en-GB").replace("/20","/")}</td>
                <td className="p-0.25 pl-0 pr-0.5 text-right">{g.total_qty}</td>
                {/* <td className="p-0.5">{g.narration || '-'}</td> */}
                <td className="p-0.5 text-center">{g.challan||
                  <button className="text-blue-600 hover:underline"
                          onClick={(e) => { e.stopPropagation(); exportOrder(g.order_id);}}>
                      ExpORD
                  </button>}
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

      {/* Modal overlay for order details */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-50"
          onClick={() => setSelectedOrder(null)} // Close on outside click
        >
          {/* <div>
            <table>
              <tbody>
                <tr className='border'>
                  <td className='border'>Dealer</td>
                  <td className='border'>City</td>
                </tr>
                <tr className='border'>
                  <td className='border'>Subhash</td>
                  <td className='border'>Hisar</td>
                </tr>
              </tbody>
            </table>
          </div> */}
          {/* */}
          <div
            className="bg-white p-3 rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()} // Prevent close on inside click
            id="order-details-modal"
            ref={captureRef}
          >
            <style>{`
              #order-details-modal, #order-details-modal * {
                font-family: comic sans ms !important;
                font-size: 12px !important;
                color: #000 !important;
                box-sizing: border-box !important;
                background-clip: padding-box !important;
              }
              #order-details-modal table {
                width: 100% !important;
                border-collapse: collapse !important;
                border-spacing: 0 !important;
                //table-layout: fixed !important;
              }
              #order-details-modal td,
              #order-details-modal th,
              #order-details-modal tr 
              {
                border: 0.5px solid #000 !important;
              }
              #order-details-modal td,
              #order-details-modal th {
                padding: 0.15rem !important;
              }
              .qty-td {
                text-align: center !important;
                font-size: 13.5px !important;
              }
            `}</style>
            {/* <div className="flex w-full">
              <div className="flex-5"><h3 className="text-md font-semibold mb-1">{selectedOrder.dealer?.name}</h3></div>
              <div className="flex-1 flex flex-col mb-2">
                <span className='text-sm font-semibold'>{new Date(selectedOrder.created_at).toLocaleDateString("en-GB").replace("/20","/")}</span>
                <span className='text-sm font-semibold'>{selectedOrder.challan||""}</span>
              </div>
            </div>
            <div className="mb-2 italic text-sm border-1">Narration:&nbsp;
            {selectedOrder.narration}
            </div> */}
            <div style={{ display: "flex", width: "100%" }}>
              <div style={{ flex: 5 }}>
                <h3 style={{fontSize: "1rem", // text-md
                    fontWeight: 600, // font-semibold
                    marginBottom: "0.25rem" // mb-1
                  }}>{selectedOrder.dealer?.name}</h3>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {new Date(selectedOrder.created_at).toLocaleDateString("en-GB").replace("/20","/")}
                </span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {selectedOrder.challan || ""}
                </span>
              </div>
            </div>
            <div style={{ marginBottom: "0.5rem", fontStyle: "italic", fontSize: "0.875rem", borderWidth: "1px" }}>
              Narration:&nbsp;{selectedOrder.narration}
            </div>

            {adultItems.length > 0 && (
              <div className="mb-2">

                <table><tbody>
                <tr className='border'>
                        <td className="w-21 text-center text-xs font-medium border">Product Name</td>
                        {ADULT_SIZES.map(size => (
                          <td key={size} style={{ textAlign: "center" }} className="w-8 text-center text-xs font-medium border p-0">{size}</td>
                        ))}
                        <td style={{ textAlign: "center" }} className="w-8 text-center text-xs font-medium border p-0">Total</td>
                      </tr>
                  
                {adultItems.map((item: any, idx: number) => {
                  const quantities = item.quantities || {};
                  const total = Object.values(quantities).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
                  return (
                    // <div key={idx} className="mb-0">
                      //<table><tbody>
                      <tr key={idx} className='border'>
                        <td className="w-21 text-left text-xs font-medium border p-0">{item.base?.base_name_nick?.toLowerCase().replace('maestro', '').replace('divya', '')} {item.price>0 && `(${item.price})`}</td>
                        {ADULT_SIZES.map(size => (
                          <td key={size} className="qty-td w-8 text-center border p-0">{quantities[size] || '-'}</td>
                        ))}
                        <td className="qty-td w-8 text-center p-0">{total}</td>
                      </tr>
                      //</tbody></table>
                    //</div>
                  );
                })}
                </tbody></table>
              </div>
            )}

            {kidsItems.length > 0 && (
              <div className="mb-2">
                <table><tbody>
                <tr className='border'>
                        <td className="w-21 text-center text-xs font-medium border">Product Name</td>
                        {KIDS_SIZES.map(size => (
                          <td key={size} style={{ textAlign: "center" }} className="w-8 text-center text-xs font-medium border p-0">{size}</td>
                        ))}
                        <td style={{ textAlign: "center" }} className="w-8 text-center text-xs font-medium border p-0">Total</td>
                      </tr>
                  {/* </tbody></table> */}
                {kidsItems.map((item: any, idx: number) => {
                  const quantities = item.quantities || {};
                  const total = Object.values(quantities).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
                  return (
                    //<div key={idx} className="mb-0">
                    //<table><tbody>
                      <tr key={idx} className='border'>
                        <td className="w-21 text-left text-xs font-medium border p-0">{item.base?.base_name_nick?.toLowerCase().replace('maestro', '').replace('divya', '')} {item.price>0 && `(${item.price})`}</td>
                        {KIDS_SIZES.map(size => (
                          <td key={size} className="qty-td w-8 text-center border p-0">{quantities[size] || '-'}</td>
                        ))}
                        <td className="qty-td w-8 text-center p-0">{total}</td>
                      </tr>
                      //</div></tbody></table>
                    //</div>
                  );
                })}
                </tbody></table>
              </div>
            )}
          </div> 
       {/**/}
        {/* Tailwind classes converted to inline styles for better html2canvas compatibility */}
        {/*  <div
            style={{
              backgroundColor: "#ffffff",
              padding: "0.75rem", // p-3
              borderRadius: "0.5rem", // rounded-lg
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)", // shadow-lg
              maxWidth: "56rem", // max-w-4xl
              width: "100%", // w-full
              maxHeight: "80vh", // max-h-[80vh]
              overflowY: "auto", // overflow-y-auto
              fontFamily: "Arial, Helvetica, sans-serif",
              color: "#000",
            }}
            onClick={e => e.stopPropagation()}
            id="order-details-modal"
            ref={captureRef}
          >*/}
           {/* <style>{`
              #order-details-modal, #order-details-modal * {
                font-family: Arial, Helvetica, sans-serif !important;
                color: #000 !important;
                box-sizing: border-box !important;
                background-clip: padding-box !important;
              }
              #order-details-modal table {
                width: 100% !important;
                border-collapse: collapse !important;
                border-spacing: 0 !important;
                table-layout: fixed !important;
              }
              #order-details-modal td,
              #order-details-modal th,
              #order-details-modal tr {
                border: 1px solid #000 !important;
              }
              #order-details-modal td,
              #order-details-modal th {
                padding: 0.15rem !important;
              }
            `}</style>
            <div style={{ display: "flex", width: "100%" }}>
              <div style={{ flex: 5 }}>
                <h3 style={{fontSize: "1rem", // text-md
                    fontWeight: 600, // font-semibold
                    marginBottom: "0.25rem" // mb-1
                  }}>{selectedOrder.dealer?.name}</h3>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {new Date(selectedOrder.created_at).toLocaleDateString("en-GB").replace("/20","/")}
                </span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                  {selectedOrder.challan || ""}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: "0.5rem", fontStyle: "italic", fontSize: "0.875rem", borderWidth: "1px", borderStyle: "solid", borderColor: "#000", padding: "0.35rem" }}>
              Narration:&nbsp;{selectedOrder.narration}
            </div>
            */}

            {/* Adult section */}
            {/*
            {adultItems.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <table>
                  <tbody>
                    <tr style={{ borderWidth: "1px" }}>
                      <td
                        style={{
                          width: "5.25rem", // w-21
                          textAlign: "center",
                          fontSize: "0.75rem", // text-xs
                          fontWeight: 500, // font-medium
                          borderWidth: "1px"
                        }}
                      >
                        Product Name
                      </td>
                      {ADULT_SIZES.map(size => (
                        <td
                          key={size}
                          style={{
                            width: "2rem", // w-8
                            textAlign: "center",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            borderWidth: "1px",
                            padding: 0
                          }}
                        >
                          {size}
                        </td>
                      ))}
                      <td
                        style={{
                          width: "2rem",
                          textAlign: "center",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          borderWidth: "1px",
                          padding: 0
                        }}
                      >
                        Total
                      </td>
                    </tr>
                  </tbody>
                </table>

                {adultItems.map((item: any, idx: number) => {
                  const quantities: Record<string, any> = item.quantities || {};
                  const total = Object.values(quantities).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
                  return (
                    <div key={idx} style={{ marginBottom: 0 }}>
                      <table>
                        <tbody>
                          <tr style={{ borderWidth: "1px" }}>
                            <td
                              style={{
                                width: "5.25rem",
                                textAlign: "left",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                borderWidth: "1px",
                                padding: 0
                              }}
                            >
                              {item.base?.base_name_nick?.toLowerCase().replace("maestro", "").replace("divya", "")}
                              {item.price > 0 && `(${item.price})`}
                            </td>
                            {ADULT_SIZES.map(size => (
                              <td
                                key={size}
                                style={{
                                  width: "2rem",
                                  textAlign: "center",
                                  borderWidth: "1px",
                                  padding: 0
                                }}
                              >
                                {quantities[size] || "-"}
                              </td>
                            ))}
                            <td style={{ width: "2rem", textAlign: "center", padding: 0 }}>{total}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
                */}
            {/* Kids section */}
            {/*
            {kidsItems.length > 0 && (
              <div style={{ marginBottom: "0.5rem" }}>
                <table>
                  <tbody>
                    <tr style={{ borderWidth: "1px" }}>
                      <td
                        style={{
                          width: "5.25rem",
                          textAlign: "center",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          borderWidth: "1px"
                        }}
                      >
                        Product Name
                      </td>
                      {KIDS_SIZES.map(size => (
                        <td
                          key={size}
                          style={{
                            width: "2rem",
                            textAlign: "center",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            borderWidth: "1px",
                            padding: 0
                          }}
                        >
                          {size}
                        </td>
                      ))}
                      <td
                        style={{
                          width: "2rem",
                          textAlign: "center",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          borderWidth: "1px",
                          padding: 0
                        }}
                      >
                        Total
                      </td>
                    </tr>
                  </tbody>
                </table>

                {kidsItems.map((item: any, idx: number) => {
                  const quantities: Record<string, any> = item.quantities || {};
                  const total = Object.values(quantities).reduce((sum: number, q: any) => sum + (Number(q) || 0), 0);
                  return (
                    <div key={idx} style={{ marginBottom: 0 }}>
                      <table>
                        <tbody>
                          <tr style={{ borderWidth: "1px" }}>
                            <td
                              style={{
                                width: "5.25rem",
                                textAlign: "left",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                borderWidth: "1px",
                                padding: 0
                              }}
                            >
                              {item.base?.base_name_nick?.toLowerCase().replace("maestro", "").replace("divya", "")}
                              {item.price > 0 && `(${item.price})`}
                            </td>
                            {KIDS_SIZES.map(size => (
                              <td
                                key={size}
                                style={{
                                  width: "2rem",
                                  textAlign: "center",
                                  borderWidth: "1px",
                                  padding: 0
                                }}
                              >
                                {quantities[size] || "-"}
                              </td>
                            ))}
                            <td style={{ width: "2rem", textAlign: "center", padding: 0 }}>{total}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          */}

          <div className="flex flex-row mt-2 space-x-2">
              <button className="px-2 py-2 bg-blue-600 text-white rounded" onClick={handleDeleteOrder}>🗑️ Delete</button>
              <button disabled className="px-2 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400" onClick={handleUpdateOrder}>Update</button>
              <button className="px-2 py-2 bg-blue-600 text-white rounded" onClick={(e) => { e.stopPropagation(); exportOrder(selectedOrder.order_id);}}>Export</button>
              <button className="px-2 py-2 bg-blue-600 text-white rounded" onClick={handleWAppImage}>WApp Image</button>
              <button disabled className="px-2 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400" onClick={handleWAppText}>Wapp Text</button>
              <button className="px-2 py-2 bg-blue-600 text-white rounded" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
        </div>
      )}
    </div>
  );
}