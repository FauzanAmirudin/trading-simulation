export function Footer() {
  return (
    <footer className="border-t border-border py-6">
      <div className="mx-auto max-w-7xl px-4 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} — Simulasi Trading & Analisis Perilaku Pasar</p>
        <p className="mt-0.5 opacity-80">Eksperimen riset perdagangan saham | Diselenggarakan untuk kepentingan akademik</p>
      </div>
    </footer>
  );
}
