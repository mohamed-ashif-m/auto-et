package com.autoet.expensetracker;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Decides which category an SMS-detected transaction belongs to.
 *
 * 1. The user's own rules (Settings > Smart rules) are checked first.
 *    They are stored by the web layer in the encrypted key/value table under
 *    the key "rules" as: [{"keyword":"swiggy","category":"Food & Dining"}]
 * 2. Then the built-in keyword list below.
 * 3. Otherwise the caller's fallback category is used.
 */
public class CategoryRules {

    // Category names must match the predefined list in src/lib/defaults.ts
    private static final String[][] BUILT_IN = {
            {"Salary", "salary,payroll,stipend"},
            {"Entertainment", "netflix,spotify,hotstar,prime video,bookmyshow,pvr,inox,youtube,sonyliv,zee5,gaana"},
            {"Groceries", "bigbasket,blinkit,zepto,instamart,dmart,grocery,groceries,supermarket,reliance fresh,more retail,jiomart"},
            {"Food & Dining", "swiggy,zomato,restaurant,cafe,dominos,kfc,mcdonalds,pizza,biryani,bakery,starbucks,burger,juice"},
            {"Transport", "uber,ola,rapido,irctc,redbus,metro,fuel,petrol,diesel,indian oil,bharat petroleum,hp pay,fastag,cab"},
            {"Shopping", "amazon,flipkart,myntra,meesho,ajio,nykaa,lifestyle,max fashion,pantaloons,decathlon"},
            {"Bills & Utilities", "electricity,tneb,tangedco,bescom,airtel,jio,vodafone,bsnl,recharge,broadband,dth,tata play,water bill,gas bill,postpaid,insurance"},
            {"Healthcare", "pharmacy,apollo,medplus,hospital,clinic,1mg,pharmeasy,netmeds,diagnostic,doctor,dental"},
            {"Education", "udemy,coursera,college,school,tuition,exam fee,byjus,unacademy"},
    };

    /**
     * @param merchant the parsed merchant / payee name
     * @param content  the full notification text (only used by custom rules,
     *                 so a bank name in the SMS can't trigger a built-in rule)
     */
    public static String categorize(
            AutoEtDatabase database,
            String merchant,
            String content,
            String fallback
    ) {
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
                    String category = rule.optString("category", "").trim();

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
                    return group[0];
                }
            }
        }

        return fallback;
    }

    private static boolean matches(String haystack, String keyword) {
        Pattern pattern = Pattern.compile(
                "(?<![a-z0-9])" + Pattern.quote(keyword) + "(?![a-z0-9])"
        );
        return pattern.matcher(haystack).find();
    }
}
