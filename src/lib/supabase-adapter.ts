import { supabase } from "@/lib/supabase-client";
import type { StorageAdapter } from "@/lib/storage";
import type { GardenState } from "@/lib/garden-store";

export function createSupabaseAdapter(userId: string): StorageAdapter {
  return {
    async load() {
      const { data, error } = await supabase
        .from("garden_state")
        .select("state")
        .eq("user_id", userId)
        .maybeSingle();
      if (error || !data) return null;
      const state = data.state as GardenState;
      if (!state || Object.keys(state).length === 0) return null;
      return state;
    },
    async save(state: GardenState) {
      const { error } = await supabase
        .from("garden_state")
        .upsert({ user_id: userId, state }, { onConflict: "user_id" });
      if (error) throw new Error(`Supabase 저장 실패: ${error.message}`);
    },
  };
}
