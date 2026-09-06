import { db } from "./index";
import { users, questions, questionnaireResponses, respondentProfiles } from "./schema";
import { eq, asc } from "drizzle-orm";
import { classifyByStandardCutoff, getProfileByCategories, CategoryType } from "../lib/questionnaire-logic";

export async function seedSampleResponses() {
  console.log("🌱 Seeding sample respondent questionnaire profiles...");

  const allRespondents = await db
    .select()
    .from(users)
    .where(eq(users.role, "responden"))
    .orderBy(asc(users.id));

  const allQuestions = await db
    .select()
    .from(questions)
    .orderBy(asc(questions.instrument), asc(questions.orderNumber));

  const laQuestions = allQuestions.filter((q) => q.instrument === "LA");
  const eiQuestions = allQuestions.filter((q) => q.instrument === "EI");

  if (allQuestions.length === 0) {
    console.error("No questions found in DB. Run seed:questionnaire first.");
    return;
  }

  // Pre-designed profile variations for first 18 respondents
  const targetProfiles: { laCat: CategoryType; eiCat: CategoryType }[] = [
    { laCat: "T", eiCat: "T" }, // Group A (LATEIT)
    { laCat: "T", eiCat: "S" }, // Group B (LATEIS)
    { laCat: "T", eiCat: "R" }, // Group C (LATEIR)
    { laCat: "S", eiCat: "T" }, // Group D (LASEIT)
    { laCat: "S", eiCat: "S" }, // Group E (LASEIS)
    { laCat: "S", eiCat: "R" }, // Group F (LASEIR)
    { laCat: "R", eiCat: "T" }, // Group G (LAREIT)
    { laCat: "R", eiCat: "S" }, // Group H (LAREIS)
    { laCat: "R", eiCat: "R" }, // Group I (LAREIR)
    { laCat: "T", eiCat: "T" },
    { laCat: "T", eiCat: "S" },
    { laCat: "S", eiCat: "T" },
    { laCat: "S", eiCat: "S" },
    { laCat: "R", eiCat: "S" },
    { laCat: "R", eiCat: "R" },
    { laCat: "T", eiCat: "R" },
    { laCat: "S", eiCat: "R" },
    { laCat: "R", eiCat: "T" },
  ];

  for (let idx = 0; idx < Math.min(allRespondents.length, targetProfiles.length); idx++) {
    const user = allRespondents[idx];
    const target = targetProfiles[idx];

    // Generate score distributions to hit target category
    // T: avg 4.0 - 4.8 (total 60-72)
    // S: avg 2.8 - 3.4 (total 42-51)
    // R: avg 1.5 - 2.3 (total 22-35)

    const getScoreForCat = (cat: CategoryType) => {
      if (cat === "T") return Math.random() > 0.3 ? 5 : 4;
      if (cat === "S") return Math.random() > 0.5 ? 3 : Math.random() > 0.5 ? 4 : 2;
      return Math.random() > 0.3 ? 1 : 2;
    };

    // Clean existing
    await db.delete(questionnaireResponses).where(eq(questionnaireResponses.userId, user.id));

    let laSum = 0;
    const laInserts = laQuestions.map((q) => {
      const score = getScoreForCat(target.laCat);
      laSum += score;
      return {
        userId: user.id,
        questionId: q.id,
        instrument: "LA" as const,
        score,
      };
    });

    let eiSum = 0;
    const eiInserts = eiQuestions.map((q) => {
      const score = getScoreForCat(target.eiCat);
      eiSum += score;
      return {
        userId: user.id,
        questionId: q.id,
        instrument: "EI" as const,
        score,
      };
    });

    await db.insert(questionnaireResponses).values([...laInserts, ...eiInserts]);

    const laAvg = Number((laSum / laQuestions.length).toFixed(2));
    const eiAvg = Number((eiSum / eiQuestions.length).toFixed(2));

    const laCat = classifyByStandardCutoff(laSum, laQuestions.length);
    const eiCat = classifyByStandardCutoff(eiSum, eiQuestions.length);
    const profileDef = getProfileByCategories(laCat, eiCat);

    const now = new Date(Date.now() - idx * 1000 * 60 * 15); // Staggered timestamps

    const existingProfile = await db
      .select()
      .from(respondentProfiles)
      .where(eq(respondentProfiles.userId, user.id))
      .limit(1);

    if (existingProfile.length === 0) {
      await db.insert(respondentProfiles).values({
        userId: user.id,
        laRawScore: laSum,
        laAvgScore: laAvg.toString(),
        laCategory: laCat,
        eiRawScore: eiSum,
        eiAvgScore: eiAvg.toString(),
        eiCategory: eiCat,
        profileCode: profileDef.code,
        profileLabel: profileDef.label,
        profileGroup: profileDef.group,
        isCompleted: true,
        completedAt: now,
      });
    } else {
      await db
        .update(respondentProfiles)
        .set({
          laRawScore: laSum,
          laAvgScore: laAvg.toString(),
          laCategory: laCat,
          eiRawScore: eiSum,
          eiAvgScore: eiAvg.toString(),
          eiCategory: eiCat,
          profileCode: profileDef.code,
          profileLabel: profileDef.label,
          profileGroup: profileDef.group,
          isCompleted: true,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(respondentProfiles.userId, user.id));
    }
  }

  console.log("✅ Sample respondent questionnaire profiles seeded successfully!");
}

if (require.main === module) {
  seedSampleResponses()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Error seeding sample responses:", err);
      process.exit(1);
    });
}
