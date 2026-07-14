import fs from "fs";
import path from "path";
import { getSupabaseAdmin } from "./supabase-server";

export interface Claim {
  id: string;
  establishment_id: string;
  requester_user_id: string | null;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  requester_role: string;
  requester_message: string;
  proof_document_url: string;
  status: "pending" | "approved" | "rejected";
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  establishments?: {
    id: string;
    name: string;
    short_id: string | null;
    address: string | null;
    status: string;
    user_id: string | null;
  } | null;
}

const LOCAL_STORE_PATH = path.join(process.cwd(), "business_claims_store.json");

// Helper to check if Supabase table 'business_claims' exists and is queryable
async function testTableExists(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("business_claims").select("id").limit(1);
    if (error && (error.message.includes("schema cache") || error.message.includes("does not exist"))) {
      return false;
    }
    return !error;
  } catch {
    return false;
  }
}

// Local File Store Helpers
function readLocalClaims(): Claim[] {
  try {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const data = fs.readFileSync(LOCAL_STORE_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("[ClaimsStore] Error reading local file claims:", err);
  }
  return [];
}

function writeLocalClaims(claims: Claim[]) {
  try {
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(claims, null, 2), "utf-8");
  } catch (err) {
    console.error("[ClaimsStore] Error writing local file claims:", err);
  }
}

export const ClaimsStore = {
  async getClaims(): Promise<Claim[]> {
    const supabase = getSupabaseAdmin();
    const useSupabase = await testTableExists();

    if (useSupabase && supabase) {
      console.log("[ClaimsStore] Querying claims from Supabase database...");
      const { data, error } = await supabase
        .from("business_claims")
        .select(`
          id,
          establishment_id,
          requester_user_id,
          requester_name,
          requester_email,
          requester_phone,
          requester_message,
          requester_role,
          proof_document_url,
          status,
          admin_notes,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          establishments:establishments (
            id,
            name,
            short_id,
            address,
            status,
            user_id
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[ClaimsStore] Supabase error in getClaims:", error.message);
        throw error;
      }
      return (data || []) as any[];
    } else {
      console.log("[ClaimsStore] Falling back to local file store for getClaims...");
      const localClaims = readLocalClaims();
      
      // Populate establishments for each local claim to match Supabase response structure
      if (supabase && localClaims.length > 0) {
        const updatedClaims: Claim[] = [];
        for (const claim of localClaims) {
          const { data: est } = await supabase
            .from("establishments")
            .select("id, name, short_id, address, status, user_id")
            .eq("id", claim.establishment_id)
            .maybeSingle();

          updatedClaims.push({
            ...claim,
            establishments: est || null
          });
        }
        return updatedClaims;
      }
      return localClaims;
    }
  },

  async getClaimById(id: string): Promise<Claim | null> {
    const supabase = getSupabaseAdmin();
    const useSupabase = await testTableExists();

    if (useSupabase && supabase) {
      const { data, error } = await supabase
        .from("business_claims")
        .select(`
          id,
          establishment_id,
          requester_user_id,
          requester_name,
          requester_email,
          requester_phone,
          requester_message,
          requester_role,
          proof_document_url,
          status,
          admin_notes,
          reviewed_by,
          reviewed_at,
          created_at,
          updated_at,
          establishments:establishments (
            id,
            name,
            short_id,
            address,
            status,
            user_id
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("[ClaimsStore] Supabase error in getClaimById:", error.message);
        throw error;
      }
      return data as any;
    } else {
      const localClaims = readLocalClaims();
      const claim = localClaims.find(c => c.id === id);
      if (claim && supabase) {
        const { data: est } = await supabase
          .from("establishments")
          .select("id, name, short_id, address, status, user_id")
          .eq("id", claim.establishment_id)
          .maybeSingle();

        claim.establishments = est || null;
      }
      return claim || null;
    }
  },

  async checkExistingClaims(establishmentId: string): Promise<Claim[]> {
    const supabase = getSupabaseAdmin();
    const useSupabase = await testTableExists();

    if (useSupabase && supabase) {
      const { data, error } = await supabase
        .from("business_claims")
        .select("id, requester_user_id, status")
        .eq("establishment_id", establishmentId)
        .eq("status", "pending");

      if (error) {
        console.error("[ClaimsStore] Supabase error in checkExistingClaims:", error.message);
        throw error;
      }
      return (data || []) as any[];
    } else {
      const localClaims = readLocalClaims();
      return localClaims.filter(c => c.establishment_id === establishmentId && c.status === "pending");
    }
  },

  async insertClaim(claimData: Omit<Claim, "id" | "status" | "admin_notes" | "reviewed_by" | "reviewed_at" | "created_at" | "updated_at">): Promise<Claim> {
    const supabase = getSupabaseAdmin();
    const useSupabase = await testTableExists();
    const now = new Date().toISOString();

    const newClaim: Claim = {
      ...claimData,
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(2) + Date.now().toString(36),
      status: "pending",
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      created_at: now,
      updated_at: now
    };

    if (useSupabase && supabase) {
      const { data, error } = await supabase
        .from("business_claims")
        .insert({
          establishment_id: newClaim.establishment_id,
          requester_user_id: newClaim.requester_user_id,
          requester_name: newClaim.requester_name,
          requester_email: newClaim.requester_email,
          requester_phone: newClaim.requester_phone,
          requester_message: newClaim.requester_message,
          requester_role: newClaim.requester_role,
          proof_document_url: newClaim.proof_document_url,
          status: newClaim.status
        })
        .select()
        .single();

      if (error) {
        console.error("[ClaimsStore] Supabase error in insertClaim:", error.message);
        throw error;
      }
      return data as any;
    } else {
      const localClaims = readLocalClaims();
      localClaims.push(newClaim);
      writeLocalClaims(localClaims);
      return newClaim;
    }
  },

  async updateClaim(id: string, update: Partial<Omit<Claim, "id" | "created_at">>): Promise<Claim> {
    const supabase = getSupabaseAdmin();
    const useSupabase = await testTableExists();
    const now = new Date().toISOString();

    if (useSupabase && supabase) {
      const { data, error } = await supabase
        .from("business_claims")
        .update({
          ...update,
          updated_at: now
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("[ClaimsStore] Supabase error in updateClaim:", error.message);
        throw error;
      }
      return data as any;
    } else {
      const localClaims = readLocalClaims();
      const index = localClaims.findIndex(c => c.id === id);
      if (index === -1) {
        throw new Error("Solicitação de reivindicação não encontrada.");
      }
      const updatedClaim = {
        ...localClaims[index],
        ...update,
        updated_at: now
      };
      localClaims[index] = updatedClaim;
      writeLocalClaims(localClaims);
      return updatedClaim;
    }
  }
};
