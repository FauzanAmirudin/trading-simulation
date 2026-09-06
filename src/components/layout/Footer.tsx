export function Footer() {
  return (
    <footer className="hidden md:block border-t border-border/60 py-6 bg-background/50">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} — Simulasi Investasi & Analisis Perilaku Pasar</p>
        <p className="mt-0.5 opacity-80">Eksperimen riset perdagangan saham | Diselenggarakan untuk kepentingan akademik</p>
      </div>
    </footer>
  );
}
