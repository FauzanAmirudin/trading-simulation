export function Footer() {
  return (
    <footer className="border-t py-6">
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} — Simulasi Trading Saham Eksperimental</p>
        <p className="mt-1">Diselenggarakan untuk kepentingan riset dan pendidikan</p>
      </div>
    </footer>
  );
}
