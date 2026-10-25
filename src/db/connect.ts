import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connStr = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/trading_simulasi";

declare global {
  // eslint-disable-next-line no-var
  var __db_pool__: Pool | undefined;
}

const pool =
  globalThis.__db_pool__ ||
  new Pool({
    connectionString: connStr,
    max: 25,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__db_pool__ = pool;
}

import { sql } from "drizzle-orm";

export const db = drizzle({ client: pool, schema });

let schemaEnsured = false;

export async function ensureQuestionnaireSchema() {
  if (schemaEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS questions (
        id serial PRIMARY KEY,
        instrument varchar(10) NOT NULL,
        order_number integer NOT NULL,
        question_text text NOT NULL,
        is_active boolean DEFAULT true NOT NULL,
        scale_min integer DEFAULT 1 NOT NULL,
        scale_max integer DEFAULT 5 NOT NULL,
        scale_min_label varchar(50) DEFAULT 'Sangat Tidak Setuju' NOT NULL,
        scale_max_label varchar(50) DEFAULT 'Sangat Setuju' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS questionnaire_responses (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id),
        question_id integer NOT NULL REFERENCES questions(id),
        instrument varchar(10) NOT NULL,
        score integer NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS questionnaire_responses_user_question_idx ON questionnaire_responses(user_id, question_id);
      CREATE INDEX IF NOT EXISTS questionnaire_responses_user_instrument_idx ON questionnaire_responses(user_id, instrument);

      CREATE TABLE IF NOT EXISTS respondent_profiles (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) UNIQUE,
        la_raw_score integer DEFAULT 0 NOT NULL,
        la_avg_score numeric(5, 2) DEFAULT '0.00' NOT NULL,
        la_category varchar(10) DEFAULT 'S' NOT NULL,
        ei_raw_score integer DEFAULT 0 NOT NULL,
        ei_avg_score numeric(5, 2) DEFAULT '0.00' NOT NULL,
        ei_category varchar(10) DEFAULT 'S' NOT NULL,
        profile_code varchar(20) DEFAULT 'LASEIS' NOT NULL,
        profile_label varchar(50) DEFAULT 'LA(S)+EI(S)' NOT NULL,
        profile_group varchar(5) DEFAULT 'E' NOT NULL,
        is_completed boolean DEFAULT false NOT NULL,
        completed_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS respondent_profiles_user_idx ON respondent_profiles(user_id);
      CREATE INDEX IF NOT EXISTS respondent_profiles_group_idx ON respondent_profiles(profile_group);

      CREATE TABLE IF NOT EXISTS respondent_biodata (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) UNIQUE,
        jenis_kelamin varchar(20) NOT NULL,
        usia integer NOT NULL,
        program_studi varchar(255) NOT NULL,
        semester integer NOT NULL,
        pernah_investasi_saham varchar(10) NOT NULL,
        pernah_pelatihan_investasi varchar(10) NOT NULL,
        sumber_penghasilan varchar(50) NOT NULL,
        sumber_penghasilan_lainnya varchar(255),
        jurusan_sma varchar(50) NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS respondent_biodata_user_idx ON respondent_biodata(user_id);

      CREATE TABLE IF NOT EXISTS simulation_evaluations (
        id serial PRIMARY KEY,
        user_id integer NOT NULL REFERENCES users(id) UNIQUE,
        q1 integer NOT NULL,
        q2 integer NOT NULL,
        q3 integer NOT NULL,
        q4 integer NOT NULL,
        q5 integer NOT NULL,
        q6 integer NOT NULL,
        q7 integer NOT NULL,
        q8 integer NOT NULL,
        q9 integer NOT NULL,
        q10 integer NOT NULL,
        answers jsonb NOT NULL,
        is_completed boolean DEFAULT true NOT NULL,
        completed_at timestamp DEFAULT now() NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS simulation_evaluations_user_idx ON simulation_evaluations(user_id);
    `);
    schemaEnsured = true;
  } catch (err) {
    console.error("Auto schema ensure error:", err);
  }
}

