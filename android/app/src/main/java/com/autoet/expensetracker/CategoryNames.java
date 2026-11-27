package com.autoet.expensetracker;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Maps the stable category ids used by the SMS rules to the names the user sees
 * today. Settings are written by the web layer under the existing "settings"
 * key of kv_store; one small JSON parse happens only when an SMS is processed.
 * Missing/malformed settings fall back to the original default names, and no
 * failure here is ever allowed to stop a transaction from being saved.
 */
public final class CategoryNames {

    public static final String OTHER_ID = "other";
    public static final String FALLBACK_ID = "online-payment";
    private static final String SETTINGS_KEY = "settings";

    private static final LinkedHashMap<String, String> DEFAULTS = new LinkedHashMap<>();
    private static final Map<String, String> NAME_TO_ID = new HashMap<>();

    static {
        DEFAULTS.put("online-payment", "Online Payment");
        DEFAULTS.put("cash", "Cash");
        DEFAULTS.put("food", "Food & Dining");
        DEFAULTS.put("groceries", "Groceries");
        DEFAULTS.put("transport", "Transport");
        DEFAULTS.put("shopping", "Shopping");
        DEFAULTS.put("bills", "Bills & Utilities");
        DEFAULTS.put("healthcare", "Healthcare");
        DEFAULTS.put("entertainment", "Entertainment");
        DEFAULTS.put("education", "Education");
        DEFAULTS.put("salary", "Salary");
        DEFAULTS.put(OTHER_ID, "Other");
        for (Map.Entry<String, String> entry : DEFAULTS.entrySet()) {
            NAME_TO_ID.put(entry.getValue().toLowerCase(Locale.ROOT), entry.getKey());
        }
    }

    private CategoryNames() {}

    public static String defaultName(String id) {
        String value = DEFAULTS.get(id);
        return value != null ? value : id;
    }

    /** id -> current display name. Always returns a usable map. */
    public static Map<String, String> current(AutoEtDatabase database) {
        Map<String, String> resolved = new HashMap<>(DEFAULTS);
        try {
            if (database == null) return resolved;
            KvEntry entry = database.kvDao().get(SETTINGS_KEY);
            if (entry == null || entry.value == null) return resolved;

            JSONObject settings = new JSONObject(entry.value);
            JSONArray categories = settings.optJSONArray("categories");
            if (categories == null) return resolved;

            for (int i = 0; i < categories.length(); i++) {
                JSONObject category = categories.getJSONObject(i);
                String id = category.optString("id", "").trim();
                String name = category.optString("name", "").trim();
                if (DEFAULTS.containsKey(id) && !name.isEmpty()) {
                    resolved.put(id, name);
                }
            }
        } catch (Exception ignored) {
            // A malformed settings blob must never block transaction saving.
        }
        return resolved;
    }

    public static String nameFor(Map<String, String> names, String id) {
        if (names != null) {
            String current = names.get(id);
            if (current != null && !current.isEmpty()) return current;
        }
        return defaultName(id);
    }

    /**
     * Resolves a name stored before a rename: current names win, then ORIGINAL
     * names of predefined categories are translated to today's name.
     */
    public static String resolveStored(Map<String, String> names, String stored) {
        String value = stored == null ? "" : stored.trim();
        if (value.isEmpty()) return nameFor(names, FALLBACK_ID);
        if (names != null) {
            for (String current : names.values()) {
                if (current.equalsIgnoreCase(value)) return current;
            }
        }
        String id = NAME_TO_ID.get(value.toLowerCase(Locale.ROOT));
        return id != null ? nameFor(names, id) : value;
    }
}
