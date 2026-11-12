export function sortRespondentsSequentially<T extends { nama?: string | null; id?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const nameA = (a.nama || "").trim();
    const nameB = (b.nama || "").trim();

    const isRespA = /^responden\d+/i.test(nameA);
    const isRespB = /^responden\d+/i.test(nameB);

    if (isRespA && !isRespB) return -1;
    if (!isRespA && isRespB) return 1;

    const matchA = nameA.match(/\d+/);
    const matchB = nameB.match(/\d+/);

    if (matchA && matchB) {
      const prefixA = nameA.replace(/\d+.*/, "").toLowerCase();
      const prefixB = nameB.replace(/\d+.*/, "").toLowerCase();
      if (prefixA === prefixB) {
        const numA = parseInt(matchA[0], 10);
        const numB = parseInt(matchB[0], 10);
        if (numA !== numB) return numA - numB;
      }
    }

    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: "base" });
  });
}
