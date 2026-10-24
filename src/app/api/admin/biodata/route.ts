import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/connect";
import { users, respondentBiodata } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-server";

export async function GET(req: NextRequest) {
  const auth = requireAdmin(req);
  if (!auth.authorized) return auth.response;

  try {
    // 1. Fetch all respondents and all biodata
    const [allRespondents, allBiodata] = await Promise.all([
      db
        .select({
          id: users.id,
          nama: users.nama,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.role, "responden"))
        .orderBy(asc(users.id)),
      db.select().from(respondentBiodata),
    ]);

    const biodataMap = new Map(allBiodata.map((b) => [b.userId, b]));
    const totalRegistered = allRespondents.length;
    const filledCount = allBiodata.length;
    const pendingCount = Math.max(0, totalRegistered - filledCount);
    const completionRate =
      totalRegistered > 0 ? Number(((filledCount / totalRegistered) * 100).toFixed(1)) : 0;

    // 2. Aggregate Demographics & Percentages
    // 2.1 Jenis Kelamin
    let countLaki = 0;
    let countPerempuan = 0;

    // 2.2 Pernah Investasi Saham
    let countSahamYa = 0;
    let countSahamTidak = 0;

    // 2.3 Pelatihan Keuangan / Investasi
    let countPelatihanYa = 0;
    let countPelatihanTidak = 0;

    // 2.4 Jurusan SMA
    let countSmaIpa = 0;
    let countSmaIps = 0;
    let countSmaBahasa = 0;

    // 2.5 Sumber Penghasilan
    let countSumberOrtu = 0;
    let countSumberBeasiswa = 0;
    let countSumberSideJob = 0;
    let countSumberLainnya = 0;
    const sumberLainnyaDetails: string[] = [];

    // 2.6 Usia
    const usiaList: number[] = [];
    const ageGroups: { [key: string]: number } = {
      "< 20": 0,
      "20 - 21": 0,
      "22 - 23": 0,
      "> 23": 0,
    };

    // 2.7 Semester
    const semesterMap: { [key: number]: number } = {};

    // 2.8 Program Studi
    const prodiMap: { [key: string]: number } = {};

    allBiodata.forEach((b) => {
      // JK
      if (b.jenisKelamin === "Laki-laki") countLaki++;
      else if (b.jenisKelamin === "Perempuan") countPerempuan++;

      // Saham
      if (b.pernahInvestasiSaham === "Ya") countSahamYa++;
      else if (b.pernahInvestasiSaham === "Tidak") countSahamTidak++;

      // Pelatihan
      if (b.pernahPelatihanInvestasi === "Ya") countPelatihanYa++;
      else if (b.pernahPelatihanInvestasi === "Tidak") countPelatihanTidak++;

      // Jurusan SMA
      if (b.jurusanSma === "IPA") countSmaIpa++;
      else if (b.jurusanSma === "IPS") countSmaIps++;
      else countSmaBahasa++;

      // Sumber Penghasilan
      if (b.sumberPenghasilan === "Orang tua") countSumberOrtu++;
      else if (b.sumberPenghasilan === "Beasiswa") countSumberBeasiswa++;
      else if (b.sumberPenghasilan === "Pekerjaan sampingan") countSumberSideJob++;
      else {
        countSumberLainnya++;
        if (b.sumberPenghasilanLainnya) {
          sumberLainnyaDetails.push(b.sumberPenghasilanLainnya);
        }
      }

      // Usia
      if (typeof b.usia === "number") {
        usiaList.push(b.usia);
        if (b.usia < 20) ageGroups["< 20"]++;
        else if (b.usia <= 21) ageGroups["20 - 21"]++;
        else if (b.usia <= 23) ageGroups["22 - 23"]++;
        else ageGroups["> 23"]++;
      }

      // Semester
      if (typeof b.semester === "number") {
        semesterMap[b.semester] = (semesterMap[b.semester] || 0) + 1;
      }

      // Prodi
      if (b.programStudi) {
        const cleanedProdi = b.programStudi.trim();
        prodiMap[cleanedProdi] = (prodiMap[cleanedProdi] || 0) + 1;
      }
    });

    const calcPct = (count: number) =>
      filledCount > 0 ? Number(((count / filledCount) * 100).toFixed(1)) : 0;

    // Age stats
    const avgAge =
      usiaList.length > 0
        ? Number((usiaList.reduce((acc, curr) => acc + curr, 0) / usiaList.length).toFixed(1))
        : 0;
    const minAge = usiaList.length > 0 ? Math.min(...usiaList) : 0;
    const maxAge = usiaList.length > 0 ? Math.max(...usiaList) : 0;

    // Sorted Prodi List
    const sortedProdi = Object.entries(prodiMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: calcPct(count),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    // Sorted Semester List
    const sortedSemester = Object.entries(semesterMap)
      .map(([semStr, count]) => ({
        semester: Number(semStr),
        count,
        percentage: calcPct(count),
      }))
      .sort((a, b) => a.semester - b.semester);

    // 3. Combined Respondent Row List
    const respondentList = allRespondents.map((u) => {
      const b = biodataMap.get(u.id);
      return {
        userId: u.id,
        nama: u.nama,
        isFilled: Boolean(b),
        biodata: b
          ? {
              jenisKelamin: b.jenisKelamin,
              usia: b.usia,
              programStudi: b.programStudi,
              semester: b.semester,
              pernahInvestasiSaham: b.pernahInvestasiSaham,
              pernahPelatihanInvestasi: b.pernahPelatihanInvestasi,
              sumberPenghasilan: b.sumberPenghasilan,
              sumberPenghasilanLainnya: b.sumberPenghasilanLainnya,
              jurusanSma: b.jurusanSma,
              createdAt: b.createdAt.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalRegistered,
        filledCount,
        pendingCount,
        completionRate,
        jenisKelamin: {
          lakiLaki: { count: countLaki, percentage: calcPct(countLaki) },
          perempuan: { count: countPerempuan, percentage: calcPct(countPerempuan) },
        },
        pernahInvestasiSaham: {
          ya: { count: countSahamYa, percentage: calcPct(countSahamYa) },
          tidak: { count: countSahamTidak, percentage: calcPct(countSahamTidak) },
        },
        pelatihanInvestasi: {
          ya: { count: countPelatihanYa, percentage: calcPct(countPelatihanYa) },
          tidak: { count: countPelatihanTidak, percentage: calcPct(countPelatihanTidak) },
        },
        jurusanSma: {
          ipa: { count: countSmaIpa, percentage: calcPct(countSmaIpa) },
          ips: { count: countSmaIps, percentage: calcPct(countSmaIps) },
          bahasa: { count: countSmaBahasa, percentage: calcPct(countSmaBahasa) },
        },
        sumberPenghasilan: {
          orangTua: { count: countSumberOrtu, percentage: calcPct(countSumberOrtu) },
          beasiswa: { count: countSumberBeasiswa, percentage: calcPct(countSumberBeasiswa) },
          pekerjaanSampingan: { count: countSumberSideJob, percentage: calcPct(countSumberSideJob) },
          lainnya: { count: countSumberLainnya, percentage: calcPct(countSumberLainnya) },
          rincianLainnya: sumberLainnyaDetails,
        },
        usia: {
          average: avgAge,
          min: minAge,
          max: maxAge,
          groups: Object.entries(ageGroups).map(([group, count]) => ({
            group,
            count,
            percentage: calcPct(count),
          })),
        },
        semester: sortedSemester,
        programStudi: sortedProdi,
      },
      respondents: respondentList,
    });
  } catch (error: any) {
    console.error("Error fetching admin biodata statistics:", error);
    return NextResponse.json(
      { error: "Gagal memuat data statistik biodata responden." },
      { status: 500 }
    );
  }
}
