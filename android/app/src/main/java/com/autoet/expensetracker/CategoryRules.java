package com.autoet.expensetracker;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Decides which category an SMS-detected transaction belongs to.
 *
 * 1. The user's own rules (Settings > Smart rules) are checked first.
 *    They are stored by the web layer in the encrypted key/value table under
 *    the key "rules" as: [{"keyword":"swiggy","category":"Food & Dining"}]
 * 2. Then the built-in keyword list below, keyed by STABLE CATEGORY ID.
 * 3. Otherwise the caller's fallback category id is used.
 *
 * Stored names are translated through CategoryNames so a rename follows
 * through to SMS transactions detected while the app is closed.
 */
public class CategoryRules {

    public static final String FALLBACK_ID = CategoryNames.FALLBACK_ID;

    // IDs match DEFAULT_CATEGORIES in src/lib/defaults.ts. Only the keyword
    // strings are used for matching; the display name is resolved at run time.
    private static final String[][] BUILT_IN = {
            {"salary", "salary,payroll,stipend"},
            {"entertainment", "netflix,spotify,hotstar,prime video,bookmyshow,pvr,inox,youtube,sonyliv,zee5,gaana"},
            {"groceries", "bigbasket,blinkit,zepto,instamart,dmart,grocery,groceries,supermarket,reliance fresh,more retail,jiomart"},
            {"food", "swiggy,zomato,restaurant,cafe,dominos,kfc,mcdonalds,pizza,biryani,bakery,starbucks,burger,juice"},
            {"transport", "uber,ola,rapido,irctc,redbus,metro,fuel,petrol,diesel,indian oil,bharat petroleum,hp pay,fastag,cab"},
            {"shopping", "amazon,flipkart,myntra,meesho,ajio,nykaa,lifestyle,max fashion,pantaloons,decathlon"},
            {"bills", "electricity,tneb,tangedco,bescom,airtel,jio,vodafone,bsnl,recharge,broadband,dth,tata play,water bill,gas bill,postpaid,insurance"},
            {"healthcare", "pharmacy,apollo,medplus,hospital,clinic,1mg,pharmeasy,netmeds,diagnostic,doctor,dental"},
            {"education", "udemy,coursera,college,school,tuition,exam fee,byjus,unacademy"},
    };

    /**
     * @param merchant    the parsed merchant / payee name
     * @param content     the full notification text (only used by custom rules,
     *                    so a bank name in the SMS can't trigger a built-in rule)
     * @param fallbackId  stable id of the category used when nothing matches
     */
    public static String categorize(
            AutoEtDatabase database,
            String merchant,
            String content,
            String fallbackId
    ) {
        Map<String, String> names = CategoryNames.current(database);
        String fallback = CategoryNames.nameFor(
                names, fallbackId == null || fallbackId.isEmpty() ? FALLBACK_ID : fallbackId);

        try {
            String merchantText = merchant.toLowerCase(Locale.ROOT);
            String haystack = (merchant + " " + content).toLowerCase(Locale.ROOT);

            // 1. User-defined rules.
            try {
                KvEntry entry = database.kvDao().get("rules");

                if (entry != null && entry.value != null) {
                    JSONArray rules = new JSONArray(entry.value);

                    for (int i = 0; i < rules.length(); i++) {
                        JSONObject rule = rules.getJSONObject(i);

                        String keyword = rule.optString("keyword", "")
                                .trim().toLowerCase(Locale.ROOT);
                        String category = CategoryNames.resolveStored(
                                names, rule.optString("category", "").trim());

                        if (!keyword.isEmpty()
                                && !category.isEmpty()
                                && matches(haystack, keyword)) {
                            return category;
                        }
                    }
                }
            } catch (Exception ignored) {
                // A malformed rules blob must never block transaction saving.
            }

            // 2. Built-in rules.
            for (String[] group : BUILT_IN) {
                for (String keyword : group[1].split(",")) {
                    if (matches(merchantText, keyword)) {
                        return CategoryNames.nameFor(names, group[0]);
                    }
                }
            }

            return fallback;
        } catch (Exception ignored) {
            // Last-resort guard: categorisation must never prevent an insert.
            return fallback;
        }
    }

    private static boolean matches(String haystack, String keyword) {
        Pattern pattern = Pattern.compile(
                "(?<![a-z0-9])" + Pattern.quote(keyword) + "(?![a-z0-9])"
        );
        return pattern.matcher(haystack).find();
    }
}
