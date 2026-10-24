export type EvaluationQuestion = {
  id: number;
  orderNumber: number;
  questionText: string;
};

export const EVALUATION_QUESTIONS: EvaluationQuestion[] = [
  {
    id: 1,
    orderNumber: 1,
    questionText: "Saya memahami prosedur simulasi perdagangan saham yang telah dilakukan",
  },
  {
    id: 2,
    orderNumber: 2,
    questionText: "Saya memahami simulasi aplikasi saham yang dipakai",
  },
  {
    id: 3,
    orderNumber: 3,
    questionText: "Saya memahami cara untuk memasukkan harga saham yang saya prediksi",
  },
  {
    id: 4,
    orderNumber: 4,
    questionText: "Saya memahami bahwa akan ada konsekuensi untung dan rugi dari prediksi harga saham yang saya berikan",
  },
  {
    id: 5,
    orderNumber: 5,
    questionText: "Simulasi aplikasi yang dipakai mudah dipahami dan digunakan",
  },
  {
    id: 6,
    orderNumber: 6,
    questionText: "Saya mengetahui ada informasi pada simulasi perdagangan saham ini",
  },
  {
    id: 7,
    orderNumber: 7,
    questionText: "Saya mengerti semua informasi (berita) yang muncul selama simulasi perdagangan saham",
  },
  {
    id: 8,
    orderNumber: 8,
    questionText: "Saya mengetahui setiap kali informasi (berita) muncul di layar aplikasi simulasi perdagangan saham",
  },
  {
    id: 9,
    orderNumber: 9,
    questionText: "Saya dapat membedakan informasi (berita) yang positif dan negatif selama simulasi perdagangan saham",
  },
  {
    id: 10,
    orderNumber: 10,
    questionText: "Informasi (berita) memengaruhi saya dalam memprediksi harga saham",
  },
];

export const EVALUATION_LIKERT_OPTIONS = [
  { value: 1, label: "Sangat Tidak Setuju", short: "STS" },
  { value: 2, label: "Tidak Setuju", short: "TS" },
  { value: 3, label: "Netral", short: "N" },
  { value: 4, label: "Setuju", short: "S" },
  { value: 5, label: "Sangat Setuju", short: "SS" },
];

export function getEvaluationOptionLabel(value: number): string {
  const found = EVALUATION_LIKERT_OPTIONS.find((opt) => opt.value === value);
  return found ? found.label : `Pilihan ${value}`;
}
