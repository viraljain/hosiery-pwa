// app/page.tsx
export default function Home() {
  return (
    <main className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Welcome to Hosiery PWA</h1>
      <a className="block bg-black text-white p-3 rounded" href="/order">Go to Order</a>
      <a className="block bg-gray-800 text-white p-3 rounded" href="/summary">Go to Summary</a>
    </main>
  );
}