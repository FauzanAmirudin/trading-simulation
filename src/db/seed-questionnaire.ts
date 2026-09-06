import { db } from "./index";
import { questions } from "./schema";
import { eq, and } from "drizzle-orm";

export const LA_QUESTIONS = [
  "Saya merasa lebih kecewa ketika mengalami kerugian investasi dibandingkan rasa senang ketika memperoleh keuntungan yang sama besar.",
  "Kerugian kecil dalam investasi terasa lebih menyakitkan dibandingkan keuntungan kecil terasa menyenangkan.",
  "Saya lebih kecewa kehilangan Rp100.000 daripada senang mendapat Rp100.000.",
  "Saya cenderung menghindari keputusan yang memiliki kemungkinan rugi, meskipun potensi keuntungannya besar.",
  "Saya merasa lebih sulit menerima kerugian daripada menikmati keuntungan dengan jumlah yang sama.",
  "Saat membuat keputusan investasi, saya lebih sering memikirkan kemungkinan kerugian daripada peluang keuntungan.",
  "Saya lebih cepat bereaksi terhadap informasi negatif tentang investasi saya dibandingkan informasi positif.",
  "Saya cenderung menahan aset yang sedang merugi lebih lama daripada menjual aset yang sedang untung.",
  "Perasaan rugi memengaruhi keputusan investasi saya di masa depan lebih kuat daripada perasaan untung.",
  "Saya lebih memilih pilihan saham yang keuntungannya pasti walau imbalannya lebih kecil untuk menghindari kemungkinan rugi.",
  "Saya berpikir ulang beberapa kali sebelum membuat keputusan yang berisiko.",
  "Saya lebih memilih menahan pilihan yang netral daripada memilih opsi yang mungkin menyebabkan kerugian.",
  "Ketika menghadapi pilihan antara kemungkinan rugi dan keuntungan seimbang, saya lebih memilih menghindari pilihan tersebut.",
  "Seberapa besar kemungkinan Anda akan bertaruh dalam permainan yang menawarkan peluang 50% untuk memenangkan $150 dan peluang 50% untuk kehilangan $100?",
  "Seberapa besar kemungkinan Anda akan bertaruh dalam permainan yang menawarkan peluang 50% untuk memenangkan $200 dan peluang 50% untuk kehilangan $100?",
];

export const EI_QUESTIONS = [
  "Saya dapat mengenali emosi saya sendiri dan efeknya.",
  "Saya tahu kekuatan dan kelemahan saya.",
  "Saya memiliki harga diri dan kemampuan yang kuat.",
  "Saya dapat mengendalikan emosi dan impuls yang mengganggu.",
  "Saya dapat menjaga integritas dan bertindak sesuai dengan nilai-nilai saya.",
  "Saya gigih mengejar tujuan saya meskipun ada rintangan dan kemunduran.",
  "Saya menggunakan fleksibilitas dalam menangani perubahan.",
  "Saya berusaha untuk meningkatkan atau memenuhi standar keunggulan.",
  "Saya selalu siap untuk bertindak berdasarkan peluang.",
  "Saya merasakan perasaan dan perspektif orang lain dan secara aktif tertarik pada kekhawatiran mereka.",
  "Saya memahami arus emosional dan hubungan kekuasaan dalam kelompok saya.",
  "Saya mengantisipasi, mengenali dan memenuhi kebutuhan pelanggan saya.",
  "Saya merasakan kebutuhan perkembangan orang lain dan meningkatkan kemampuan mereka.",
  "Saya menginspirasi dan membimbing individu dan kelompok.",
  "Saya menggunakan taktik yang efektif untuk persuasi.",
];

export async function seedQuestionnaires() {
  console.log("🌱 Seeding psychological questionnaire items (LA & EI)...");

  // Seed LA Questions
  for (let i = 0; i < LA_QUESTIONS.length; i++) {
    const orderNumber = i + 1;
    const text = LA_QUESTIONS[i];
    const existing = await db
      .select()
      .from(questions)
      .where(and(eq(questions.instrument, "LA"), eq(questions.orderNumber, orderNumber)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(questions).values({
        instrument: "LA",
        orderNumber,
        questionText: text,
        isActive: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: "Sangat Tidak Setuju",
        scaleMaxLabel: "Sangat Setuju",
      });
    } else {
      await db
        .update(questions)
        .set({ questionText: text })
        .where(eq(questions.id, existing[0].id));
    }
  }

  // Seed EI Questions
  for (let i = 0; i < EI_QUESTIONS.length; i++) {
    const orderNumber = i + 1;
    const text = EI_QUESTIONS[i];
    const existing = await db
      .select()
      .from(questions)
      .where(and(eq(questions.instrument, "EI"), eq(questions.orderNumber, orderNumber)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(questions).values({
        instrument: "EI",
        orderNumber,
        questionText: text,
        isActive: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleMinLabel: "Sangat Tidak Setuju",
        scaleMaxLabel: "Sangat Setuju",
      });
    } else {
      await db
        .update(questions)
        .set({ questionText: text })
        .where(eq(questions.id, existing[0].id));
    }
  }

  console.log("✅ 30 Questionnaire items (15 LA & 15 EI) seeded successfully!");
}

if (require.main === module) {
  seedQuestionnaires()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Error seeding questionnaires:", err);
      process.exit(1);
    });
}
